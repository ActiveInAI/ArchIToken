"""Source-build orchestration for heavy CAD/BIM/media adapters.

The builder keeps GPL, LGPL, commercial and desktop runtimes outside the
distributed core. It clones upstream source, builds into an isolated prefix and
writes evidence that can be attached to adapter audit records.
"""

from __future__ import annotations

import argparse
import json
import os
import time
import subprocess
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Iterable


DEFAULT_ROOT = Path(os.getenv("ARCHITOKEN_SOURCE_BUILD_ROOT", "/tmp/architoken-source-builds"))


@dataclass(frozen=True)
class SourceBuildProject:
    """One source-buildable upstream project or licensed source boundary."""

    id: str
    label: str
    source_urls: tuple[str, ...]
    ref: str
    license: str
    boundary: str
    build_kind: str
    commands: tuple[tuple[str, ...], ...] = ()
    smoke: tuple[tuple[str, ...], ...] = ()
    source_url_env: str | None = None
    required_env: tuple[str, ...] = ()
    outputs: tuple[str, ...] = ()
    notes: tuple[str, ...] = ()


SOURCE_BUILD_PROJECTS: dict[str, SourceBuildProject] = {
    "python-3-13": SourceBuildProject(
        id="python-3-13",
        label="CPython 3.13 source toolchain for Blender",
        source_urls=("https://github.com/python/cpython.git",),
        ref="v3.13.13",
        license="Python-2.0",
        boundary="source_build_toolchain",
        build_kind="autotools",
        commands=(
            ("./configure", "--prefix={prefix}", "--enable-shared", "LDFLAGS=-Wl,-rpath,{prefix}/lib"),
            ("make", "-j", "{jobs}"),
            ("make", "install"),
        ),
        smoke=(("{prefix}/bin/python3.13", "--version"),),
        outputs=("python3.13", "libpython3.13.so", "Python 3.13 headers"),
        notes=(
            "Blender main currently requires Python 3.13 on Linux; system Python 3.12 is not valid completion evidence.",
            "The v3.13.13 tag was resolved from the CPython upstream tag list before adding this manifest.",
        ),
    ),
    "sse2neon": SourceBuildProject(
        id="sse2neon",
        label="sse2neon SIMD header for Blender arm64 builds",
        source_urls=("https://github.com/DLTcollab/sse2neon.git",),
        ref="HEAD",
        license="MIT",
        boundary="source_build_header_dependency",
        build_kind="header_only",
        commands=(
            ("cmake", "-E", "make_directory", "{prefix}/include"),
            ("cmake", "-E", "copy", "{source}/sse2neon.h", "{prefix}/include/sse2neon.h"),
        ),
        smoke=(("test", "-f", "{prefix}/include/sse2neon.h"),),
        outputs=("sse2neon.h",),
        notes=("Blender arm64 source builds require this header when distro packages do not provide it.",),
    ),
    "opencolorio": SourceBuildProject(
        id="opencolorio",
        label="OpenColorIO color management library for Blender",
        source_urls=("https://github.com/AcademySoftwareFoundation/OpenColorIO.git",),
        ref="HEAD",
        license="BSD-3-Clause",
        boundary="source_build_library",
        build_kind="cmake",
        commands=(
            (
                "cmake",
                "-S",
                "{source}",
                "-B",
                "{build}",
                "-DCMAKE_BUILD_TYPE=Release",
                "-DCMAKE_INSTALL_PREFIX={prefix}",
                "-DOCIO_BUILD_APPS=OFF",
                "-DOCIO_BUILD_TESTS=OFF",
                "-DOCIO_BUILD_GPU_TESTS=OFF",
                "-DOCIO_BUILD_PYTHON=OFF",
                "-DOCIO_INSTALL_EXT_PACKAGES=MISSING",
            ),
            ("cmake", "--build", "{build}", "--parallel", "{jobs}"),
            ("cmake", "--install", "{build}"),
        ),
        smoke=(("test", "-f", "{prefix}/lib/cmake/OpenColorIO/OpenColorIOConfig.cmake"),),
        outputs=("OpenColorIO library", "OpenColorIOConfig.cmake", "headers"),
        notes=("Used when distro CMake targets point to invalid include paths.",),
    ),
    "tree-sitter": SourceBuildProject(
        id="tree-sitter",
        label="tree-sitter incremental parser for code intelligence",
        source_urls=("https://github.com/tree-sitter/tree-sitter.git",),
        ref="v0.26.9",
        license="MIT",
        boundary="source_build_worker_or_wasm_parser",
        build_kind="rust_cli",
        commands=(
            ("cargo", "install", "--path", "{source}/cli", "--locked", "--root", "{prefix}"),
        ),
        smoke=(("{prefix}/bin/tree-sitter", "--version"),),
        outputs=("tree-sitter CLI", "grammar parser generator", "query runtime evidence"),
        notes=(
            "Used for source-bound code/config syntax trees, code search and worker-side diagnostics.",
            "The Monaco editor remains the browser editing UI; tree-sitter is the parser/intelligence route, not a source-file replacement.",
        ),
    ),
    "blender": SourceBuildProject(
        id="blender",
        label="Blender isolated scene/render/video service",
        source_urls=("https://github.com/blender/blender.git",),
        ref="main",
        license="GPL-3.0-or-later",
        boundary="external_process_or_service",
        build_kind="cmake_headless",
        required_env=("ARCHITOKEN_PYTHON313_PREFIX", "SSE2NEON_INCLUDE_DIR", "OPENCOLORIO_DIR"),
        commands=(
            (
                "python3",
                "-c",
                "from pathlib import Path; p=Path('{source}/source/blender/blenlib/BLI_ustring.hh'); text=p.read_text(); needle='#include <OpenImageIO/ustring.h>\\n'; alias='namespace OpenImageIO = OIIO;\\n'; text=text.replace(needle, needle + '\\n' + alias, 1) if alias not in text else text; text=text.replace('return OpenImageIO::Strutil::strhash64(value.size(), value.data());', 'return uint64_t(OpenImageIO::Strutil::strhash(value.size(), value.data()));'); text=text.replace('  /* This is initialized to null by default. */\\n  static std::atomic<UString> static_ustr;\\n  UString ustr = static_ustr.load(std::memory_order_relaxed);\\n  if (ustr.c_str() == nullptr) [[unlikely]] {\\n    ustr = UString::from_ptr_noinline(FStr.data);\\n    static_ustr.store(ustr, std::memory_order_relaxed);\\n  }\\n  return ustr;', '  static const UString ustr = UString::from_ptr_noinline(FStr.data);\\n  return ustr;'); marker='template<> struct is_range<blender::UString, char> : std::false_type {};'; formatter='template<> struct formatter<blender::UString, char> : formatter<std::string_view, char> {\\n  template<typename FormatContext> auto format(const blender::UString &str, FormatContext &ctx) const\\n  {\\n    return formatter<std::string_view, char>::format(str.string(), ctx);\\n  }\\n};\\n\\n'; text=text.replace(marker, formatter + marker, 1) if 'formatter<blender::UString, char>' not in text else text; p.write_text(text)",
            ),
            (
                "python3",
                "-c",
                "from pathlib import Path; p=Path('{source}/source/blender/imbuf/intern/oiio/openimageio_support.cc'); text=p.read_text(); text=text.replace('  unique_ptr<ImageInput> in = ImageInput::create(format);\\n  if (!(in && in->valid_file(&mem_reader))) {\\n    return nullptr;\\n  }\\n\\n  /* Open the reader using the ioproxy. */', '  unique_ptr<ImageInput> in = ImageInput::create(format);\\n  if (!in) {\\n    return nullptr;\\n  }\\n\\n  /* Open the reader using the ioproxy. */'); text=text.replace('  unique_ptr<ImageInput> in = ImageInput::create(file_format);\\n  return in && in->valid_file(&mem_reader);', '  unique_ptr<ImageInput> in = ImageInput::create(file_format);\\n  if (!in) {\\n    return false;\\n  }\\n  in->set_ioproxy(&mem_reader);\\n  return in->open(\"\", spec, config);'); p.write_text(text)",
            ),
            (
                "python3",
                "-c",
                "from pathlib import Path; p=Path('{source}/source/blender/nodes/function/nodes/node_fn_format_string.cc'); text=p.read_text(); text=text.replace('static void format_with_fmt(const fmt::runtime_format_string<> format,', 'static void format_with_fmt(const fmt::basic_runtime<char> format,'); p.write_text(text)",
            ),
            (
                "python3",
                "-c",
                "from pathlib import Path; replacements={ 'fmt::println(\"Writing to {}\", filepath);':'fmt::print(\"Writing to {}\\\\n\", filepath);', 'fmt::println(\"Writing to {}\", filepath_with_frames);':'fmt::print(\"Writing to {}\\\\n\", filepath_with_frames);', 'fmt::println(\"    DU {} (as dupped by {}):\",':'fmt::print(\"    DU {} (as dupped by {}):\\\\n\",', 'fmt::println(\"    OB {}:\",':'fmt::print(\"    OB {}:\\\\n\",', 'fmt::println(\"       - {}{}{}\",':'fmt::print(\"       - {}{}{}\\\\n\",', 'fmt::println(\"       - {} (dup by {}{}) {}\",':'fmt::print(\"       - {} (dup by {}{}) {}\\\\n\",', 'fmt::println(\"    (Total graph size: {} objects)\", total_graph_size);':'fmt::print(\"    (Total graph size: {} objects)\\\\n\", total_graph_size);'}; paths=[Path('{source}/source/blender/io/wavefront_obj/exporter/obj_exporter.cc'), Path('{source}/source/blender/io/common/intern/abstract_hierarchy_iterator.cc')]; [p.write_text(__import__('functools').reduce(lambda text, pair: text.replace(pair[0], pair[1]), replacements.items(), p.read_text())) for p in paths]",
            ),
            (
                "cmake",
                "-S",
                "{source}",
                "-B",
                "{build}",
                "-C",
                "{source}/build_files/cmake/config/blender_lite.cmake",
                "-C",
                "{source}/build_files/cmake/config/blender_headless.cmake",
                "-DCMAKE_BUILD_TYPE=Release",
                "-DCMAKE_INSTALL_PREFIX={prefix}",
                "-DCMAKE_C_COMPILER=/usr/bin/gcc-14",
                "-DCMAKE_CXX_COMPILER=/usr/bin/g++-14",
                "-DWITH_LIBS_PRECOMPILED=OFF",
                "-DWITH_INSTALL_PORTABLE=OFF",
                "-DPYTHON_ROOT_DIR={env:ARCHITOKEN_PYTHON313_PREFIX}",
                "-DPYTHON_VERSION=3.13",
                "-DPYTHON_EXECUTABLE={env:ARCHITOKEN_PYTHON313_PREFIX}/bin/python3.13",
                "-DPYTHON_LIBRARY={env:ARCHITOKEN_PYTHON313_PREFIX}/lib/libpython3.13.so",
                "-DPYTHON_LIBPATH={env:ARCHITOKEN_PYTHON313_PREFIX}/lib",
                "-DPYTHON_INCLUDE_DIR={env:ARCHITOKEN_PYTHON313_PREFIX}/include/python3.13",
                "-DPYTHON_INCLUDE_CONFIG_DIR={env:ARCHITOKEN_PYTHON313_PREFIX}/include/python3.13",
                "-DSSE2NEON_INCLUDE_DIR={env:SSE2NEON_INCLUDE_DIR}",
                "-DOpenColorIO_DIR={env:OPENCOLORIO_DIR}",
                "-DWITH_GHOST_WAYLAND=OFF",
                "-DWITH_GHOST_X11=OFF",
                "-DWITH_VULKAN_BACKEND=OFF",
            ),
            ("cmake", "--build", "{build}", "--parallel", "{jobs}"),
            ("cmake", "--install", "{build}"),
        ),
        smoke=(("{build}/bin/blender", "--background", "--version"),),
        outputs=("blender", "python add-ons", "mesh/render/video workers"),
        notes=(
            "Official GitHub mirror is allowed as source input; runtime stays out of the core app.",
            "On Linux arm64, build from system/source libraries with CMake; make update/precompiled lib route is not valid completion evidence.",
            "Blender resumes its generated build directory; manual cache removal is only allowed when compiler/toolchain changes require it.",
            "CUDA/OptiX runtime use is mandatory for NVIDIA workstations, but GPU smoke cannot be marked complete until /dev/nvidia* device nodes are visible.",
        ),
    ),
    "nvidia-cuda-toolchain": SourceBuildProject(
        id="nvidia-cuda-toolchain",
        label="NVIDIA NGC CUDA workstation/container toolchain and runtime smoke",
        source_urls=(),
        ref="12.9.2-cudnn-devel-ubuntu24.04",
        license="NVIDIA-CUDA-toolkit",
        boundary="nvidia_certified_gpu_toolchain",
        build_kind="cuda_smoke",
        commands=(
            (
                "python3",
                "-c",
                "from pathlib import Path; p=Path('{build}/architoken_cuda_smoke.cu'); p.write_text('#include <cstdio>\\n#include <cuda_runtime.h>\\n__global__ void k(int* x){*x=42;}\\nint main(){int *d=nullptr; int h=0; cudaError_t e=cudaMalloc(&d,sizeof(int)); if(e!=cudaSuccess){std::printf(\"cudaMalloc:%s\\\\n\", cudaGetErrorString(e)); return 2;} k<<<1,1>>>(d); e=cudaDeviceSynchronize(); if(e!=cudaSuccess){std::printf(\"kernel:%s\\\\n\", cudaGetErrorString(e)); cudaFree(d); return 3;} e=cudaMemcpy(&h,d,sizeof(int),cudaMemcpyDeviceToHost); cudaFree(d); if(e!=cudaSuccess){std::printf(\"copy:%s\\\\n\", cudaGetErrorString(e)); return 4;} std::printf(\"cuda-smoke:%d\\\\n\", h); return h==42?0:5;}\\n')",
            ),
            ("cmake", "-E", "make_directory", "{prefix}/bin"),
            ("/usr/local/cuda/bin/nvcc", "-O2", "{build}/architoken_cuda_smoke.cu", "-o", "{prefix}/bin/architoken-cuda-smoke"),
        ),
        smoke=(("/usr/bin/nvidia-smi",), ("{prefix}/bin/architoken-cuda-smoke",)),
        outputs=("nvidia-smi runtime evidence", "architoken-cuda-smoke", "CUDA runtime evidence"),
        notes=(
            "Use an NVIDIA NGC signed CUDA/CUDA-DL image tag or digest plus NVIDIA Container Toolkit or GPU Operator/device plugin; do not use latest.",
            "This is a real CUDA compile and runtime smoke for designer/developer NVIDIA workstations and GPU worker containers.",
            "If /dev/nvidia* is not visible, nvidia-smi or the CUDA smoke must fail and record evidence instead of being treated as success.",
            "Mesa, CPU-only, WebGL-only, screenshots and empty canvases are compatibility bypasses, not NVIDIA GPU rendering evidence.",
        ),
    ),
    "intel-oneapi-toolchain": SourceBuildProject(
        id="intel-oneapi-toolchain",
        label="Intel oneAPI / Level Zero SYCL runtime smoke",
        source_urls=(),
        ref="system-oneapi",
        license="Intel-oneAPI",
        boundary="host_gpu_toolchain",
        build_kind="oneapi_sycl_smoke",
        commands=(
            (
                "python3",
                "-c",
                "from pathlib import Path; p=Path('{build}/architoken_oneapi_smoke.cpp'); p.write_text('#include <sycl/sycl.hpp>\\n#include <iostream>\\nint main(){int result=0; try{sycl::queue q; {sycl::buffer<int,1> b(&result, sycl::range<1>(1)); q.submit([&](sycl::handler& h){auto acc=b.get_access<sycl::access::mode::write>(h); h.single_task([=](){acc[0]=42;});}); q.wait_and_throw();} std::cout<<\"oneapi-device:\"<<q.get_device().get_info<sycl::info::device::name>()<<\"\\\\n\"; std::cout<<\"oneapi-smoke:\"<<result<<\"\\\\n\"; return result==42?0:5;} catch(const sycl::exception& e){std::cout<<\"oneapi-error:\"<<e.what()<<\"\\\\n\"; return 6;}}\\n')",
            ),
            ("cmake", "-E", "make_directory", "{prefix}/bin"),
            (
                "bash",
                "-lc",
                "compiler=\"$(command -v icpx || command -v dpcpp || true)\"; if [ -z \"$compiler\" ]; then echo 'missing Intel oneAPI compiler: icpx or dpcpp'; exit 127; fi; \"$compiler\" -fsycl '{build}/architoken_oneapi_smoke.cpp' -o '{prefix}/bin/architoken-oneapi-smoke'",
            ),
        ),
        smoke=(("{prefix}/bin/architoken-oneapi-smoke",),),
        outputs=("architoken-oneapi-smoke", "SYCL/oneAPI runtime evidence"),
        notes=(
            "This is a real Intel oneAPI/SYCL compile and runtime smoke for Intel GPU/CPU-capable nodes.",
            "If icpx/dpcpp, Level Zero, OpenCL or a usable SYCL device is missing, the smoke must fail and record evidence instead of being treated as success.",
        ),
    ),
    "intel-llvm-oneapi": SourceBuildProject(
        id="intel-llvm-oneapi",
        label="Intel LLVM oneAPI DPC++/SYCL source toolchain",
        source_urls=("https://github.com/intel/llvm.git",),
        ref="sycl",
        license="Apache-2.0-with-LLVM-exception",
        boundary="source_build_toolchain",
        build_kind="dpcpp_source_toolchain",
        commands=(
            (
                "python3",
                "{source}/buildbot/configure.py",
                "-o",
                "{build}",
                "--host-target",
                "AArch64;ARM;X86",
                "--native_cpu",
                "--cmake-gen",
                "Ninja",
            ),
            (
                "python3",
                "{source}/buildbot/compile.py",
                "-o",
                "{build}",
                "-j",
                "{jobs}",
                "-t",
                "deploy-sycl-toolchain",
            ),
            ("cmake", "-E", "make_directory", "{prefix}/bin"),
            ("cmake", "-E", "create_symlink", "{build}/bin/clang++", "{prefix}/bin/icpx"),
            (
                "python3",
                "-c",
                "from pathlib import Path; p=Path('{build}/architoken_intel_llvm_sycl_smoke.cpp'); p.write_text('#include <sycl/sycl.hpp>\\n#include <iostream>\\nint main(){int result=0; try{sycl::queue q; {sycl::buffer<int,1> b(&result, sycl::range<1>(1)); q.submit([&](sycl::handler& h){auto acc=b.get_access<sycl::access::mode::write>(h); h.single_task([=](){acc[0]=42;});}); q.wait_and_throw();} std::cout<<\"intel-llvm-oneapi-device:\"<<q.get_device().get_info<sycl::info::device::name>()<<\"\\\\n\"; std::cout<<\"intel-llvm-oneapi-smoke:\"<<result<<\"\\\\n\"; return result==42?0:5;} catch(const sycl::exception& e){std::cout<<\"intel-llvm-oneapi-error:\"<<e.what()<<\"\\\\n\"; return 6;}}\\n')",
            ),
            (
                "bash",
                "-lc",
                "'{build}/bin/clang++' -fsycl -fsycl-targets=native_cpu '{build}/architoken_intel_llvm_sycl_smoke.cpp' -Wl,-rpath,'{build}/install/lib' -Wl,-rpath,'{build}/lib' -o '{prefix}/bin/architoken-intel-llvm-oneapi-smoke'",
            ),
        ),
        smoke=(
            ("{build}/bin/clang++", "--version"),
            ("{prefix}/bin/architoken-intel-llvm-oneapi-smoke",),
        ),
        outputs=("clang++ DPC++/SYCL toolchain", "icpx symlink", "SYCL native CPU smoke"),
        notes=(
            "Official Intel LLVM DPC++ build route supports ARM host experiments with --host-target AArch64;ARM;X86 and native CPU device.",
            "This is the source-built oneAPI route for ARM64 hosts when Intel binary packages are unavailable.",
            "CUDA/HIP plugins can be added to this source toolchain after the base SYCL compiler smoke is completed.",
        ),
    ),
    "ifcopenshell": SourceBuildProject(
        id="ifcopenshell",
        label="IfcOpenShell IFC geometry and validation worker",
        source_urls=("https://github.com/IfcOpenShell/IfcOpenShell.git",),
        ref="ifcconvert-0.8.5",
        license="LGPL-3.0",
        boundary="isolated_worker_or_service",
        build_kind="cmake",
        required_env=("OpenCASCADE_DIR",),
        commands=(
            (
                "python3",
                "-c",
                "from pathlib import Path; p=Path('{source}/cmake/FindOpenCASCADE.cmake'); text=p.read_text(); needle='    # OpenCASCADE may be built with VTK support. Try to find VTK first to avoid\\n    # CMake errors when OpenCASCADE\\'s config references VTK targets.\\n    find_package(VTK QUIET)\\n    mark_as_advanced(VTK_DIR)'; replacement='    # ArchIToken builds OCCT without VTK for the isolated worker route.\\n    # Avoid host VTK/MPI discovery because distro MPI configs can inject compiler flags as paths.\\n    set(VTK_FOUND FALSE CACHE BOOL \"ArchIToken isolated OCCT worker disables host VTK lookup\" FORCE)'; p.write_text(text.replace(needle, replacement) if needle in text else text)",
            ),
            (
                "python3",
                "-c",
                "from pathlib import Path; p=Path('{source}/src/ifcgeom/ConversionResult.h'); text=p.read_text(); text=text.replace('#include <unordered_map>\\n', '#include <unordered_map>\\n#include <type_traits>\\n') if '#include <type_traits>' not in text else text; old='\\t\\ttemplate <typename... Args>\\n\\t\\tOpaqueCoordinate(Args... args) {\\n\\t\\t\\tstatic_assert(sizeof...(args) == N, \"Incorrect number of arguments provided\");\\n\\t\\t\\tinit_<0>(args...);\\n\\t\\t}\\n'; new='\\t\\ttemplate <typename... Args, std::enable_if_t<sizeof...(Args) == N, int> = 0>\\n\\t\\tOpaqueCoordinate(Args... args) {\\n\\t\\t\\tinit_<0>(args...);\\n\\t\\t}\\n'; p.write_text(text.replace(old, new) if old in text else text)",
            ),
            (
                "cmake",
                "-S",
                "{source}/cmake",
                "-B",
                "{build}",
                "-DCMAKE_BUILD_TYPE=Release",
                "-DCMAKE_INSTALL_PREFIX={prefix}",
                "-DOpenCASCADE_DIR={env:OpenCASCADE_DIR}",
                "-DPYTHON_EXECUTABLE=/usr/bin/python3",
                "-DPython_EXECUTABLE=/usr/bin/python3",
                "-DPython3_EXECUTABLE=/usr/bin/python3",
                "-DPYTHON_INCLUDE_DIR=/usr/include/python3.12",
                "-DPYTHON_LIBRARY=/usr/lib/aarch64-linux-gnu/libpython3.12.so",
                "-DPYTHON_MODULE_INSTALL_DIR={prefix}/lib/python3.12/site-packages",
                "-DWITH_CGAL=OFF",
                "-DWITH_OPENCASCADE=ON",
                "-DCOLLADA_SUPPORT=OFF",
                "-DUSD_SUPPORT=OFF",
                "-DWITH_ROCKSDB=OFF",
            ),
            ("cmake", "--build", "{build}", "--parallel", "{jobs}"),
            ("cmake", "--install", "{build}"),
        ),
        smoke=(("{prefix}/bin/IfcConvert", "--help"),),
        outputs=("IfcConvert", "ifcopenshell python module", "Bonsai source tree"),
        notes=(
            "Bonsai lives in this repository and is handled by the bonsai build entry.",
            "This worker route builds IfcOpenShell with the OCCT kernel; CGAL remains a separately compiled isolated worker instead of blocking IFC conversion.",
            "The source patch constrains OpaqueCoordinate's variadic constructor so SWIG wrappers can copy wrapper values instead of instantiating an invalid N-argument constructor.",
        ),
    ),
    "bonsai": SourceBuildProject(
        id="bonsai",
        label="Bonsai BIM Blender add-on from IfcOpenShell source",
        source_urls=("https://github.com/IfcOpenShell/IfcOpenShell.git",),
        ref="bonsai-0.8.5.post1",
        license="GPL-3.0-or-later",
        boundary="blender_external_addon_service",
        build_kind="python_addon_compile",
        commands=(
            ("python3", "-m", "compileall", "{source}/src/bonsai"),
        ),
        smoke=(("test", "-d", "{source}/src/bonsai"),),
        outputs=("Bonsai Blender add-on source", "compiled Python bytecode"),
        notes=("Use through isolated Blender; do not vendor GPL add-on code into the core app.",),
    ),
    "occt": SourceBuildProject(
        id="occt",
        label="OpenCascade OCCT CAD kernel worker",
        source_urls=("https://github.com/Open-Cascade-SAS/OCCT.git",),
        ref="master",
        license="LGPL-2.1-with-exception",
        boundary="native_worker_or_wasm_worker",
        build_kind="cmake",
        commands=(
            (
                "cmake",
                "-S",
                "{source}",
                "-B",
                "{build}",
                "-DCMAKE_BUILD_TYPE=Release",
                "-DCMAKE_INSTALL_PREFIX={prefix}",
                "-DBUILD_LIBRARY_TYPE=Shared",
                "-DBUILD_MODULE_Draw=ON",
                "-DUSE_TCL=ON",
                "-DUSE_TK=ON",
                "-DUSE_XLIB=ON",
                "-DUSE_FREETYPE=ON",
                "-D3RDPARTY_TCL_INCLUDE_DIR=/usr/include/tcl8.6",
                "-D3RDPARTY_TCL_LIBRARY=/usr/lib/aarch64-linux-gnu/libtcl8.6.so",
                "-D3RDPARTY_TCL_LIBRARY_DIR=/usr/lib/aarch64-linux-gnu",
                "-D3RDPARTY_TK_INCLUDE_DIR=/usr/include/tcl8.6",
                "-D3RDPARTY_TK_LIBRARY=/usr/lib/aarch64-linux-gnu/libtk8.6.so",
                "-D3RDPARTY_TK_LIBRARY_DIR=/usr/lib/aarch64-linux-gnu",
            ),
            ("cmake", "--build", "{build}", "--parallel", "{jobs}"),
            ("cmake", "--install", "{build}"),
        ),
        smoke=(("test", "-x", "{prefix}/bin/DRAWEXE"),),
        outputs=("OCCT libraries", "headers", "DRAWEXE", "TCL/TK/X11 Draw toolkits"),
    ),
    "occt-7-9-1": SourceBuildProject(
        id="occt-7-9-1",
        label="OpenCascade OCCT 7.9.1 compatibility CAD kernel worker",
        source_urls=("https://github.com/Open-Cascade-SAS/OCCT.git",),
        ref="V7_9_1",
        license="LGPL-2.1-with-exception",
        boundary="native_worker_or_wasm_worker",
        build_kind="cmake",
        commands=(
            (
                "cmake",
                "-S",
                "{source}",
                "-B",
                "{build}",
                "-DCMAKE_BUILD_TYPE=Release",
                "-DCMAKE_INSTALL_PREFIX={prefix}",
                "-DBUILD_LIBRARY_TYPE=Shared",
                "-DBUILD_MODULE_Draw=ON",
                "-DUSE_TCL=ON",
                "-DUSE_TK=ON",
                "-DUSE_XLIB=ON",
                "-DUSE_FREETYPE=ON",
                "-D3RDPARTY_TCL_INCLUDE_DIR=/usr/include/tcl8.6",
                "-D3RDPARTY_TCL_LIBRARY=/usr/lib/aarch64-linux-gnu/libtcl8.6.so",
                "-D3RDPARTY_TCL_LIBRARY_DIR=/usr/lib/aarch64-linux-gnu",
                "-D3RDPARTY_TK_INCLUDE_DIR=/usr/include/tcl8.6",
                "-D3RDPARTY_TK_LIBRARY=/usr/lib/aarch64-linux-gnu/libtk8.6.so",
                "-D3RDPARTY_TK_LIBRARY_DIR=/usr/lib/aarch64-linux-gnu",
            ),
            ("cmake", "--build", "{build}", "--parallel", "{jobs}"),
            ("cmake", "--install", "{build}"),
        ),
        smoke=(("test", "-x", "{prefix}/bin/DRAWEXE"),),
        outputs=("OCCT 7.9.1 libraries", "headers", "DRAWEXE", "IfcOpenShell-compatible toolkits"),
        notes=("Compatibility target for upstreams that have not yet adjusted to OCCT 8 API changes.",),
    ),
    "libredwg": SourceBuildProject(
        id="libredwg",
        label="LibreDWG GPL-isolated DWG/DXF sidecar",
        source_urls=("https://github.com/LibreDWG/libredwg.git",),
        ref="master",
        license="GPL-3.0",
        boundary="gpl_external_process",
        build_kind="autotools",
        commands=(
            ("sh", "./autogen.sh"),
            ("./configure", "--prefix={prefix}", "--disable-bindings", "--disable-docs", "--disable-shared"),
            ("make", "-j", "{jobs}"),
            ("make", "install"),
        ),
        smoke=(("{prefix}/bin/dwgread", "--version"),),
        outputs=("dwgread", "dwg2dxf", "GPL sidecar tools"),
    ),
    "freecad": SourceBuildProject(
        id="freecad",
        label="FreeCAD headless CAD/BIM conversion sidecar",
        source_urls=("https://github.com/FreeCAD/FreeCAD.git",),
        ref="main",
        license="LGPL-2.1-or-later",
        boundary="external_process_or_container",
        build_kind="cmake",
        required_env=("OpenCASCADE_DIR",),
        commands=(
            (
                "python3",
                "-c",
                "from pathlib import Path; p=Path('{source}/cMake/FreeCAD_Helpers/SetupQt.cmake'); text=p.read_text(); marker='function(qt_find_and_add_translation _qm_files _tr_dir _qm_dir)'; patch='if(NOT COMMAND qt_add_translation)\\n    function(qt_add_translation _qm_files)\\n        set(\"${_qm_files}\" \"\" PARENT_SCOPE)\\n    endfunction()\\nendif()\\n\\n'+marker; p.write_text(text.replace(marker, patch) if 'if(NOT COMMAND qt_add_translation)' not in text else text)",
            ),
            (
                "python3",
                "-c",
                "from pathlib import Path; import os; cmake_dir=Path(os.environ['OpenCASCADE_DIR']); prefix=cmake_dir.parents[2]; lib=prefix/'lib'; src=lib/'libTKRWMesh.so'; dst=lib/'libTKDEGLTF.so'; dst.symlink_to(src.name) if src.exists() and not dst.exists() else None",
            ),
            (
                "cmake",
                "-S",
                "{source}",
                "-B",
                "{build}",
                "-DCMAKE_BUILD_TYPE=Release",
                "-DCMAKE_INSTALL_PREFIX={prefix}",
                "-DBUILD_GUI=OFF",
                "-DBUILD_ASSEMBLY=OFF",
                "-DBUILD_BIM=OFF",
                "-DBUILD_CAM=OFF",
                "-DBUILD_TECHDRAW=OFF",
                "-DBUILD_DRAFT=OFF",
                "-DBUILD_DRAWING=OFF",
                "-DBUILD_OPENSCAD=OFF",
                "-DBUILD_SPREADSHEET=OFF",
                "-DBUILD_TEST=OFF",
                "-DENABLE_DEVELOPER_TESTS=OFF",
                "-DINSTALL_TO_SITEPACKAGES=OFF",
                "-DPython3_EXECUTABLE=/usr/bin/python3",
                "-DPYTHON_EXECUTABLE=/usr/bin/python3",
                "-DOpenCASCADE_DIR={env:OpenCASCADE_DIR}",
            ),
            ("cmake", "--build", "{build}", "--parallel", "{jobs}"),
            ("cmake", "--install", "{build}"),
        ),
        smoke=(("{prefix}/bin/FreeCADCmd", "--version"),),
        outputs=("FreeCADCmd", "Part/Import/Draft modules", "OCCT-backed converters"),
    ),
    "rhino3dm": SourceBuildProject(
        id="rhino3dm",
        label="McNeel rhino3dm OpenNURBS bindings",
        source_urls=("https://github.com/mcneel/rhino3dm.git",),
        ref="main",
        license="MIT",
        boundary="worker_library",
        build_kind="python_wheel",
        commands=(
            ("uv", "build", "--wheel", "--out-dir", "{prefix}/wheels", "{source}"),
        ),
        smoke=(("test", "-d", "{prefix}/wheels"),),
        outputs=("rhino3dm wheel", "3DM read/write worker dependency"),
        notes=("If local wheel install is required, install the generated wheel into the worker venv explicitly.",),
    ),
    "opennurbs": SourceBuildProject(
        id="opennurbs",
        label="McNeel OpenNURBS native 3DM library",
        source_urls=("https://github.com/mcneel/opennurbs.git",),
        ref="HEAD",
        license="MIT",
        boundary="native_worker_library",
        build_kind="cmake",
        commands=(
            (
                "cmake",
                "-S",
                "{source}",
                "-B",
                "{build}",
                "-DCMAKE_BUILD_TYPE=Release",
                "-DCMAKE_INSTALL_PREFIX={prefix}",
                "-DCMAKE_POLICY_VERSION_MINIMUM=3.5",
            ),
            ("cmake", "--build", "{build}", "--parallel", "{jobs}"),
            ("cmake", "--install", "{build}"),
        ),
        smoke=(("test", "-d", "{prefix}/include"),),
        outputs=("OpenNURBS library", "headers", "3DM native worker dependency"),
    ),
    "cgal": SourceBuildProject(
        id="cgal",
        label="CGAL computational geometry worker",
        source_urls=("https://github.com/CGAL/cgal.git",),
        ref="HEAD",
        license="GPL-3.0-or-commercial",
        boundary="isolated_worker_or_commercial_license",
        build_kind="cmake",
        commands=(
            ("cmake", "-S", "{source}", "-B", "{build}", "-DCMAKE_BUILD_TYPE=Release", "-DCMAKE_INSTALL_PREFIX={prefix}"),
            ("cmake", "--build", "{build}", "--parallel", "{jobs}"),
            ("cmake", "--install", "{build}"),
        ),
        smoke=(("test", "-f", "{prefix}/lib/cmake/CGAL/CGALConfig.cmake"),),
        outputs=("CGALConfig.cmake", "mesh repair/boolean/simplification worker dependency"),
    ),
    "cgal-swig-bindings": SourceBuildProject(
        id="cgal-swig-bindings",
        label="CGAL SWIG Python worker bindings",
        source_urls=("https://github.com/CGAL/cgal-swig-bindings.git",),
        ref="HEAD",
        license="GPL-3.0-or-commercial",
        boundary="isolated_worker_or_commercial_license",
        build_kind="cmake_python",
        required_env=("CGAL_DIR",),
        commands=(
            (
                "cmake",
                "-S",
                "{source}",
                "-B",
                "{build}",
                "-DCMAKE_BUILD_TYPE=Release",
                "-DCMAKE_INSTALL_PREFIX={prefix}",
                "-DCGAL_DIR={env:CGAL_DIR}",
                "-DPython_EXECUTABLE=/usr/bin/python3",
                "-DPython3_EXECUTABLE=/usr/bin/python3",
                "-DPYTHON_EXECUTABLE=/usr/bin/python3",
                "-DBUILD_PYTHON=ON",
                "-DBUILD_JAVA=OFF",
                "-DBUILD_RUBY=OFF",
            ),
            ("cmake", "--build", "{build}", "--parallel", "{jobs}"),
            ("cmake", "--install", "{build}"),
        ),
        smoke=(("test", "-d", "{prefix}"),),
        outputs=("CGAL Python bindings",),
        notes=(
            "CGAL core is the cgal manifest from https://github.com/CGAL/cgal.git; SWIG bindings are an optional binding layer and cannot replace the core CGAL build evidence.",
            "Use system Python 3.12 for bindings on this host so the worker route is not tied to an experimental uv Python.",
        ),
    ),
    "emsdk": SourceBuildProject(
        id="emsdk",
        label="Emscripten SDK for browser CAD/BIM WASM builds",
        source_urls=("https://github.com/emscripten-core/emsdk.git",),
        ref="main",
        license="MIT",
        boundary="source_build_toolchain",
        build_kind="toolchain",
        commands=(
            ("./emsdk", "install", "4.0.23"),
            ("./emsdk", "activate", "4.0.23"),
        ),
        smoke=(("test", "-x", "{source}/upstream/emscripten/emcmake"),),
        outputs=("emcmake", "emmake", "Emscripten LLVM/Node toolchain"),
        notes=("Required for real WebIFC and browser OCCT/IFC WASM builds; apt emscripten is not assumed.",),
    ),
    "thatopen-engine-web-ifc": SourceBuildProject(
        id="thatopen-engine-web-ifc",
        label="ThatOpen web-ifc IFC WASM runtime",
        source_urls=("https://github.com/ThatOpen/engine_web-ifc.git",),
        ref="main",
        license="MPL-2.0",
        boundary="browser_wasm_or_node_worker",
        build_kind="emscripten_npm",
        required_env=("EMSDK",),
        commands=(
            ("bash", "-lc", "source \"$EMSDK/emsdk_env.sh\" >/dev/null && npm install"),
            ("bash", "-lc", "source \"$EMSDK/emsdk_env.sh\" >/dev/null && npm run build-release"),
        ),
        smoke=(
            ("test", "-f", "{source}/dist/web-ifc.wasm"),
            ("test", "-f", "{source}/dist/web-ifc-api.js"),
        ),
        outputs=("web-ifc.wasm", "web-ifc-api.js", "web-ifc-api-node.js"),
        notes=("This is a real WASM build; dry-run output is not accepted as completion evidence.",),
    ),
    "thatopen-web-ifc-three": SourceBuildProject(
        id="thatopen-web-ifc-three",
        label="ThatOpen web-ifc-three Three.js IFC bridge",
        source_urls=("https://github.com/ThatOpen/web-ifc-three.git",),
        ref="main",
        license="MIT",
        boundary="frontend_dependency_or_viewer_worker",
        build_kind="npm",
        commands=(
            ("npm", "--prefix", "web-ifc-three", "pkg", "delete", "overrides.tslib"),
            ("npm", "--prefix", "web-ifc-three", "pkg", "set", "dependencies.tslib=2.3.1"),
            (
                "python3",
                "-c",
                "import json; from pathlib import Path; p=Path('{source}/web-ifc-three/package.json'); data=json.loads(p.read_text()); deps=data.setdefault('dependencies', {}); dev=data.setdefault('devDependencies', {}); deps['tslib']='2.6.2'; dev['tslib']='2.6.2'; dev['typescript']='5.4.5'; dev['@types/node']='18.19.39'; dev['@types/babel__traverse']='7.20.7'; p.write_text(json.dumps(data, indent=2)+'\\n')",
            ),
            (
                "python3",
                "-c",
                "from pathlib import Path; files=[Path('{source}/web-ifc-three/config/rollup.config.js'), Path('{source}/web-ifc-three/config/rollup-worker.config.js')]; [p.write_text(p.read_text().replace('rollup-plugin-typescript2', '@rollup/plugin-typescript')) for p in files]",
            ),
            ("npm", "--prefix", "web-ifc-three", "install"),
            ("npm", "--prefix", "web-ifc-three", "dedupe"),
            (
                "python3",
                "-c",
                "import json; from pathlib import Path; p=Path('{source}/web-ifc-three/node_modules/rollup-plugin-typescript2/node_modules/tslib/package.json'); data=json.loads(p.read_text()) if p.exists() else None; data and data.pop('exports', None); data and p.write_text(json.dumps(data, indent=2)+'\\n')",
            ),
            ("npm", "--prefix", "web-ifc-three", "run", "build"),
        ),
        smoke=(
            ("test", "-f", "{source}/web-ifc-three/dist/IFCLoader.js"),
            ("test", "-f", "{source}/web-ifc-three/dist/IFCWorker.js"),
        ),
        outputs=("IFCLoader.js", "IFCWorker.js", "TypeScript declarations"),
    ),
    "thatopen-web-ifc-viewer": SourceBuildProject(
        id="thatopen-web-ifc-viewer",
        label="ThatOpen web-ifc-viewer browser IFC viewer",
        source_urls=("https://github.com/ThatOpen/web-ifc-viewer.git",),
        ref="master",
        license="MIT",
        boundary="frontend_reference_or_isolated_viewer",
        build_kind="npm",
        commands=(
            ("npm", "--prefix", "viewer", "install"),
            ("npm", "--prefix", "viewer", "run", "build"),
        ),
        smoke=(("test", "-f", "{source}/viewer/dist/index.js"),),
        outputs=("web-ifc-viewer compiled TypeScript output",),
    ),
    "microsoft-ifc": SourceBuildProject(
        id="microsoft-ifc",
        label="Microsoft IFC SDK reader/tool",
        source_urls=("https://github.com/microsoft/ifc.git",),
        ref="main",
        license="Apache-2.0-with-LLVM-exception",
        boundary="native_worker_library",
        build_kind="cmake",
        commands=(
            ("cmake", "-E", "remove_directory", "{build}"),
            (
                "cmake",
                "-S",
                "{source}",
                "-B",
                "{build}",
                "-DCMAKE_BUILD_TYPE=Release",
                "-DCMAKE_INSTALL_PREFIX={prefix}",
                "-DBUILD_TOOLS=ON",
                "-DBUILD_TESTING=OFF",
            ),
            ("cmake", "--build", "{build}", "--parallel", "{jobs}"),
            ("cmake", "--install", "{build}"),
        ),
        smoke=(("test", "-x", "{prefix}/bin/ifc"),),
        outputs=("ifc CLI", "Microsoft.IFC static libraries", "headers"),
    ),
    "ddc-cad2data-revit-ifc-dwg-dgn": SourceBuildProject(
        id="ddc-cad2data-revit-ifc-dwg-dgn",
        label="DataDrivenConstruction CAD/BIM to data workflow",
        source_urls=("https://github.com/datadrivenconstruction/cad2data-Revit-IFC-DWG-DGN.git",),
        ref="main",
        license="NOASSERTION",
        boundary="notebook_reference_or_licensed_external_process",
        build_kind="source_sync",
        commands=(),
        smoke=(("test", "-f", "{source}/README.md"),),
        outputs=("Revit/IFC/DWG/DGN notebook workflow source",),
        notes=("The public repository is notebook/workflow source; no binary adapter is faked.",),
    ),
    "ddc-openconstructionerp": SourceBuildProject(
        id="ddc-openconstructionerp",
        label="DataDrivenConstruction OpenConstructionERP",
        source_urls=("https://github.com/datadrivenconstruction/OpenConstructionERP.git",),
        ref="main",
        license="AGPL-or-NOASSERTION",
        boundary="agpl_external_service_boundary",
        build_kind="frontend_backend",
        commands=(
            ("npm", "--prefix", "frontend", "install"),
            ("npm", "--prefix", "frontend", "run", "build"),
            ("python3", "-m", "venv", "{build}/backend-venv"),
            ("{build}/backend-venv/bin/pip", "install", "-e", "{source}/backend[server]"),
            ("python3", "-m", "compileall", "{source}/backend"),
        ),
        smoke=(
            ("test", "-d", "{build}/backend-venv"),
            ("test", "-d", "{source}/frontend/dist"),
        ),
        outputs=("compiled backend Python", "Vite frontend dist"),
        notes=("AGPL/copyleft status keeps this behind an external service/API boundary unless legal review changes it.",),
    ),
    "ddc-skills-construction": SourceBuildProject(
        id="ddc-skills-construction",
        label="DataDrivenConstruction AI construction skills",
        source_urls=("https://github.com/datadrivenconstruction/DDC_Skills_for_AI_Agents_in_Construction.git",),
        ref="main",
        license="NOASSERTION",
        boundary="toolrouter_skill_reference",
        build_kind="source_sync",
        commands=(),
        smoke=(("test", "-d", "{source}"),),
        outputs=("construction AI skill prompts/workflows"),
    ),
    "ddc-cad-bim-code-pipeline": SourceBuildProject(
        id="ddc-cad-bim-code-pipeline",
        label="DataDrivenConstruction CAD/BIM to code automation pipeline",
        source_urls=("https://github.com/datadrivenconstruction/CAD-BIM-to-Code-Automation-Pipeline-DDC-Workflow-with-LLM-ChatGPT.git",),
        ref="main",
        license="NOASSERTION",
        boundary="workflow_reference_or_isolated_agent_route",
        build_kind="source_sync",
        commands=(),
        smoke=(("test", "-f", "{source}/README.md"),),
        outputs=("CAD/BIM notebook and workflow automation source"),
    ),
    "ddc-n8n-project-management": SourceBuildProject(
        id="ddc-n8n-project-management",
        label="DataDrivenConstruction n8n project management workflow",
        source_urls=("https://github.com/datadrivenconstruction/Project-management-n8n-with-task-management-and-photo-reports.git",),
        ref="main",
        license="NOASSERTION",
        boundary="external_workflow_service",
        build_kind="workflow_source_sync",
        commands=(),
        smoke=(("test", "-f", "{source}/Project-management-n8n-with-task-management-and-photo-reports .json"),),
        outputs=("n8n workflow JSON",),
    ),
    "ddc-openconstructionestimate": SourceBuildProject(
        id="ddc-openconstructionestimate",
        label="DataDrivenConstruction OpenConstructionEstimate",
        source_urls=("https://github.com/datadrivenconstruction/OpenConstructionEstimate-DDC-CWICR.git",),
        ref="main",
        license="NOASSERTION",
        boundary="external_service_or_clean_room_reference",
        build_kind="source_sync",
        commands=(),
        smoke=(("test", "-d", "{source}"),),
        outputs=("construction estimation workflow source"),
    ),
    "louistrue-ifc5cad": SourceBuildProject(
        id="louistrue-ifc5cad",
        label="louistrue ifc5cad / Chili3D IFC5-CAD editor",
        source_urls=("https://github.com/louistrue/ifc5cad.git",),
        ref="main",
        license="NOASSERTION",
        boundary="browser_editor_or_wasm_worker",
        build_kind="npm_emscripten",
        required_env=("EMSDK",),
        commands=(
            ("npm", "install"),
            ("npm", "run", "setup:wasm"),
            ("bash", "-lc", "source \"$EMSDK/emsdk_env.sh\" >/dev/null && npm run build:wasm"),
            ("npm", "run", "build"),
        ),
        smoke=(
            ("test", "-f", "{source}/packages/chili-wasm/lib/chili-wasm.wasm"),
            ("test", "-d", "{source}/dist"),
        ),
        outputs=("browser CAD editor bundle", "chili-wasm.wasm", "IFC5/IFCX packages"),
    ),
    "louistrue-ifcliteviewer": SourceBuildProject(
        id="louistrue-ifcliteviewer",
        label="louistrue ifcLiteViewer PowerBI IFC viewer",
        source_urls=("https://github.com/louistrue/ifcLiteViewer.git",),
        ref="main",
        license="MIT",
        boundary="viewer_reference_or_isolated_visual_plugin",
        build_kind="npm",
        commands=(
            ("npm", "install"),
            (
                "npm",
                "install",
                "--no-save",
                "powerbi-visuals-tools@5.3.0",
                "ajv@8.20.0",
                "ajv-keywords@5.1.0",
            ),
            (
                "node",
                "-e",
                "const fs=require('fs');const p='node_modules/powerbi-visuals-tools/lib/WebPackWrap.js';let s=fs.readFileSync(p,'utf8');s=s.replace('const installedAPIVersion = listResults.match(regexFullVersion)[0] ?? \"not found\";','const installedAPIVersion = (listResults.match(regexFullVersion) ?? [this.pbiviz.apiVersion ?? \"not found\"])[0];');fs.writeFileSync(p,s);",
            ),
            ("npm", "run", "package"),
        ),
        smoke=(("test", "-d", "{source}/dist"),),
        outputs=("PowerBI visual package/dist",),
    ),
    "buildingsmart-standards": SourceBuildProject(
        id="buildingsmart-standards",
        label="buildingSMART standards source sync",
        source_urls=(
            "https://github.com/buildingSMART/mvdXML.git",
            "https://github.com/buildingSMART/IFC.git",
            "https://github.com/buildingSMART/IFC4-CV.git",
            "https://github.com/buildingSMART/IDS.git",
            "https://github.com/buildingSMART/bSDD.git",
            "https://github.com/buildingSMART/BCF-API.git",
            "https://github.com/buildingSMART/BCF-XML.git",
            "https://github.com/buildingSMART/OpenCDE-API.git",
            "https://github.com/buildingSMART/foundation-API.git",
            "https://github.com/buildingSMART/NextGen-IFC.git",
            "https://github.com/buildingSMART/Sample-Test-Files.git",
            "https://github.com/buildingSMART/IFC4.x-development.git",
            "https://github.com/buildingSMART/IFC4.3.x-output.git",
            "https://github.com/buildingSMART/documents-API.git",
            "https://github.com/buildingSMART/technical.buildingsmart.org.git",
            "https://github.com/buildingSMART/IFC4.3-html.git",
            "https://github.com/buildingSMART/validate.git",
            "https://github.com/buildingSMART/IDS-Audit-tool.git",
            "https://github.com/buildingSMART/ifc-gherkin-rules.git",
            "https://github.com/buildingSMART/IFC4.x-IF.git",
            "https://github.com/buildingSMART/IFC4.3.x-sample-models.git",
            "https://github.com/buildingSMART/ifc-validation-data-model.git",
            "https://github.com/buildingSMART/IFC5-development.git",
            "https://github.com/buildingSMART/ifcx.dev.git",
        ),
        ref="HEAD",
        license="mixed",
        boundary="standards_contract_source_sync",
        build_kind="standards_sync",
        commands=(),
        smoke=(("test", "-d", "{source_root}"),),
        outputs=("IFC/IDS/bSDD/BCF schema sources", "validation contract fixtures"),
        notes=("buildingSMART is a standards source, not one monolithic runtime binary.",),
    ),
    "opencascade-sas-org-source-sync": SourceBuildProject(
        id="opencascade-sas-org-source-sync",
        label="Open-Cascade-SAS organization source sync",
        source_urls=(
            "https://github.com/Open-Cascade-SAS/OCCT.git",
            "https://github.com/Open-Cascade-SAS/OCCT-Components.git",
            "https://github.com/Open-Cascade-SAS/OCCT-Samples.git",
            "https://github.com/Open-Cascade-SAS/OCCT-samples-csharp.git",
            "https://github.com/Open-Cascade-SAS/OCCT-samples-kotlin.git",
            "https://github.com/Open-Cascade-SAS/OCCT-Archive.git",
            "https://github.com/Open-Cascade-SAS/OCCT-Light.git",
            "https://github.com/Open-Cascade-SAS/Inspector.git",
            "https://github.com/Open-Cascade-SAS/CascadeScope.git",
            "https://github.com/Open-Cascade-SAS/CADRays.git",
            "https://github.com/Open-Cascade-SAS/JT-Assistant.git",
            "https://github.com/Open-Cascade-SAS/ExpToCas.git",
            "https://github.com/Open-Cascade-SAS/OCCT-wok.git",
            "https://github.com/Open-Cascade-SAS/gl2ps.git",
            "https://github.com/Open-Cascade-SAS/pmuc.git",
            "https://github.com/Open-Cascade-SAS/oryol.git",
            "https://github.com/Open-Cascade-SAS/fips.git",
            "https://github.com/Open-Cascade-SAS/opennurbs.git",
            "https://github.com/Open-Cascade-SAS/IfcOpenShell.git",
            "https://github.com/Open-Cascade-SAS/MYSTRAN.git",
            "https://github.com/Open-Cascade-SAS/NASTRAN-95.git",
        ),
        ref="HEAD",
        license="mixed",
        boundary="source_sync_and_selected_native_workers",
        build_kind="organization_source_sync",
        commands=(),
        smoke=(("test", "-d", "{source_root}"),),
        outputs=("OpenCascade organization source snapshot",),
        notes=("Concrete runtime builds remain the occt, opennurbs and ifcopenshell manifest entries.",),
    ),
    "cgal-org-source-sync": SourceBuildProject(
        id="cgal-org-source-sync",
        label="CGAL organization source sync",
        source_urls=(
            "https://github.com/CGAL/cgal.git",
            "https://github.com/CGAL/cgal-swig-bindings.git",
            "https://github.com/CGAL/cgal-dev.git",
            "https://github.com/CGAL/cgal-public-dev.git",
            "https://github.com/CGAL/cgal-testsuite-dockerfiles.git",
            "https://github.com/CGAL/cgal-nsis-dockerfile.git",
            "https://github.com/CGAL/cgal-documentation-dockerfile.git",
            "https://github.com/CGAL/cgal-mediawiki-docker.git",
            "https://github.com/CGAL/cgal-paraview-plugins.git",
            "https://github.com/CGAL/cgal-python-wheel.git",
            "https://github.com/CGAL/cgal-web.git",
            "https://github.com/CGAL/cgal.github.io.git",
            "https://github.com/CGAL/bundle-CGAL-3D-demo.git",
            "https://github.com/CGAL/LAStools.git",
            "https://github.com/CGAL/doxygen.git",
        ),
        ref="HEAD",
        license="mixed",
        boundary="source_sync_and_selected_isolated_workers",
        build_kind="organization_source_sync",
        commands=(),
        smoke=(("test", "-d", "{source_root}"),),
        outputs=("CGAL organization source snapshot",),
        notes=("Concrete runtime builds remain the cgal and cgal-swig-bindings manifest entries.",),
    ),
    "forgecad": SourceBuildProject(
        id="forgecad",
        label="ForgeCAD public source and skill sync",
        source_urls=("https://github.com/KoStard/ForgeCAD.git",),
        ref="mainline",
        license="BUSL-1.1-public-repo",
        boundary="licensed_or_external_process_service",
        build_kind="source_sync",
        commands=(),
        smoke=(("test", "-d", "{source}/skills"),),
        outputs=("ForgeCAD public examples", "ForgeCAD skill workflow source"),
        notes=("The public repository contains examples and skills; CLI/runtime source is not present there and cannot be faked.",),
    ),
    "ifcdb-agent": SourceBuildProject(
        id="ifcdb-agent",
        label="IFCDB-Agent public source sync",
        source_urls=("https://github.com/DeeJoin/IFCDB-Agent.git",),
        ref="HEAD",
        license="NOASSERTION",
        boundary="reference_or_isolated_service",
        build_kind="source_sync",
        commands=(),
        smoke=(("test", "-f", "{source}/README.md"),),
        outputs=("IFCDB-Agent source/doc snapshot",),
        notes=("No buildable runtime source has been found in the public repository; record as real source sync, not fake binary build.",),
    ),
    "cesium": SourceBuildProject(
        id="cesium",
        label="CesiumJS 3D Tiles/GIS web runtime",
        source_urls=("https://github.com/CesiumGS/cesium.git",),
        ref="main",
        license="Apache-2.0",
        boundary="web_worker_or_frontend_dependency",
        build_kind="npm",
        commands=(
            ("npm", "install"),
            ("npm", "run", "build"),
            ("npm", "run", "build-release"),
        ),
        smoke=(("test", "-f", "{source}/Build/Cesium/Cesium.js"),),
        outputs=("CesiumJS build artifacts", "3D Tiles/GIS viewer dependency"),
    ),
    "speckle-sharp": SourceBuildProject(
        id="speckle-sharp",
        label="Speckle .NET SDK and connector source",
        source_urls=("https://github.com/specklesystems/speckle-sharp.git",),
        ref="main",
        license="Apache-2.0",
        boundary="dotnet_worker_or_external_connector",
        build_kind="dotnet",
        commands=(
            ("dotnet", "restore", "SDK.slnf"),
            ("dotnet", "build", "SDK.slnf", "-c", "Release", "--no-restore"),
        ),
        smoke=(("test", "-d", "{source}/Core"),),
        outputs=("Speckle .NET SDK build", "connector-sidecar source"),
        notes=("Full connector solution may require vendor SDKs; SDK.slnf is the open source compile target.",),
    ),
    "specklesystems-org-source-sync": SourceBuildProject(
        id="specklesystems-org-source-sync",
        label="Speckle Systems organization source sync",
        source_urls=(
            "https://github.com/specklesystems/speckle-server.git",
            "https://github.com/specklesystems/speckle-sharp.git",
            "https://github.com/specklesystems/speckle-sharp-sdk.git",
            "https://github.com/specklesystems/specklepy.git",
            "https://github.com/specklesystems/speckle-blender.git",
            "https://github.com/specklesystems/speckle-sketchup.git",
            "https://github.com/specklesystems/speckle-unity.git",
            "https://github.com/specklesystems/speckle-qgis.git",
            "https://github.com/specklesystems/speckle-connectors-dui.git",
            "https://github.com/specklesystems/IFC-Exporter.git",
            "https://github.com/specklesystems/IFC-Exporter-Rhino.git",
            "https://github.com/specklesystems/IFC-Exporter-Grasshopper.git",
            "https://github.com/specklesystems/speckle-ifc-import.git",
            "https://github.com/specklesystems/speckleifc.git",
            "https://github.com/specklesystems/IFC-toolkit.git",
            "https://github.com/specklesystems/speckle_automate_python_example.git",
            "https://github.com/specklesystems/speckle-automate-checker.git",
            "https://github.com/specklesystems/speckle-automate-qa_qc_workshop.git",
            "https://github.com/specklesystems/SpeckleConWorkshop-QAQC.git",
        ),
        ref="HEAD",
        license="mixed",
        boundary="source_sync_and_selected_external_services",
        build_kind="organization_source_sync",
        commands=(),
        smoke=(("test", "-d", "{source_root}"),),
        outputs=("Speckle organization source snapshot",),
        notes=("Concrete runtime builds remain speckle-sharp and selected server/connector adapters.",),
    ),
    "sketchup-sidecar-plugin-source-sync": SourceBuildProject(
        id="sketchup-sidecar-plugin-source-sync",
        label="SketchUp SKP sidecar plugin source sync",
        source_urls=(
            "https://github.com/BIM-Tools/SketchUp-IFC-Manager.git",
            "https://github.com/YulioTech/SketchUp-glTF-Exporter-Ruby.git",
            "https://github.com/specklesystems/speckle-sketchup.git",
        ),
        ref="HEAD",
        license="mixed-GPL-MIT-Apache-2.0",
        boundary="licensed_sketchup_ruby_sidecar",
        build_kind="sidecar_plugin_source_sync",
        commands=(),
        smoke=(("test", "-d", "{source_root}"),),
        outputs=("SketchUp sidecar plugin source snapshot",),
        notes=(
            "These repositories are source inputs for a SketchUp Ruby sidecar, not core ArchIToken runtime dependencies.",
            "BIM-Tools SketchUp IFC Manager is GPL and must remain an isolated process/service boundary.",
            "Yulio and Speckle connector code still require a user-licensed SketchUp runtime for production execution.",
        ),
    ),
    "impertio-studio-openaec-source-sync": SourceBuildProject(
        id="impertio-studio-openaec-source-sync",
        label="Impertio Studio OpenAEC skill/source sync",
        source_urls=(
            "https://github.com/Impertio-Studio/Frappe_Claude_Skill_Package.git",
            "https://github.com/Impertio-Studio/.github.git",
            "https://github.com/Impertio-Studio/Blender-Bonsai-ifcOpenshell-Sverchok-Claude-Skill-Package.git",
            "https://github.com/Impertio-Studio/Tauri-2-Claude-Skill-Package.git",
            "https://github.com/Impertio-Studio/Nextcloud-Claude-Skill-Package.git",
            "https://github.com/Impertio-Studio/Fluent-i18n-Claude-Skill-Package.git",
            "https://github.com/Impertio-Studio/Vite-Claude-Skill-Package.git",
            "https://github.com/Impertio-Studio/React-Claude-Skill-Package.git",
            "https://github.com/Impertio-Studio/Skill-Package-Workflow-Template.git",
            "https://github.com/Impertio-Studio/n8n-Claude-Skill-Package.git",
            "https://github.com/Impertio-Studio/pdf-lib-Claude-Skill-Package.git",
            "https://github.com/Impertio-Studio/PDFjs-Claude-Skill-Package.git",
            "https://github.com/Impertio-Studio/SolidJS-Claude-Skill-Package.git",
            "https://github.com/Impertio-Studio/Docker-Claude-Skill-Package.git",
            "https://github.com/Impertio-Studio/Draw.io-Claude-Skill-Package.git",
            "https://github.com/Impertio-Studio/Cross-Tech-AEC-Claude-Skill-Package.git",
            "https://github.com/Impertio-Studio/ThatOpen-Claude-Skill-Package.git",
            "https://github.com/Impertio-Studio/Three.js-Claude-Skill-Package.git",
            "https://github.com/Impertio-Studio/Speckle-Claude-Skill-Package.git",
            "https://github.com/Impertio-Studio/QGIS-Claude-Skill-Package.git",
            "https://github.com/Impertio-Studio/Open-PDF-Studio-Claude-Skill-Package.git",
            "https://github.com/Impertio-Studio/erp-next-nl.git",
            "https://github.com/Impertio-Studio/Y_App-extension-kg-planning.git",
            "https://github.com/Impertio-Studio/TailwindCSS-Claude-Skill-Package.git",
            "https://github.com/Impertio-Studio/shadcn-ui-Claude-Skill-Package.git",
            "https://github.com/Impertio-Studio/Frontend-Design-Claude-Skill-Package.git",
            "https://github.com/Impertio-Studio/Rust-Claude-Skill-Package.git",
            "https://github.com/Impertio-Studio/MariaDB-Claude-Skill-Package.git",
            "https://github.com/Impertio-Studio/PostgreSQL-Claude-Skill-Package.git",
            "https://github.com/Impertio-Studio/CesiumJS-Claude-Skill-Package.git",
            "https://github.com/Impertio-Studio/pdfium-render-Claude-Skill-Package.git",
            "https://github.com/Impertio-Studio/WebGPU-Claude-Skill-Package.git",
            "https://github.com/Impertio-Studio/IFC-Claude-Skill-Package.git",
        ),
        ref="HEAD",
        license="mixed: MIT plus NOASSERTION",
        boundary="source_sync_and_selected_isolated_adapters",
        build_kind="organization_source_sync",
        commands=(),
        smoke=(("test", "-d", "{source_root}"),),
        outputs=("Impertio Studio OpenAEC skill/source snapshot",),
        notes=(
            "Repository names contain Claude upstream naming, but ArchIToken consumes them as GPT/Codex skill/source inputs.",
            "Concrete runtime adapters remain per project; this source sync records the user-supplied organization as a capability inventory.",
            "Foundational GPL/AGPL upstreams referenced by the skill packs must be isolated callable adapters, not embedded core libraries or reference-only demotions.",
        ),
    ),
    "openai-symphony-source-sync": SourceBuildProject(
        id="openai-symphony-source-sync",
        label="OpenAI Symphony orchestration source sync",
        source_urls=("https://github.com/openai/symphony.git",),
        ref="main",
        license="Apache-2.0",
        boundary="source_sync_and_isolated_workflow_service",
        build_kind="source_sync",
        commands=(),
        smoke=(("test", "-f", "{source}/README.md"),),
        outputs=("OpenAI Symphony source snapshot",),
        notes=(
            "Symphony is an orchestration source input for WorkflowRouter and ToolRouter; it must not bypass ArchIToken approvals or audit.",
            "OpenAI source use does not make OpenAI the project identity; model calls stay behind ModelRouter and InferenceRouter.",
        ),
    ),
    "openai-ai-source-sync": SourceBuildProject(
        id="openai-ai-source-sync",
        label="OpenAI selected AI SDK/eval/agent source sync",
        source_urls=(
            "https://github.com/openai/symphony.git",
            "https://github.com/openai/openai-openapi.git",
            "https://github.com/openai/openai-python.git",
            "https://github.com/openai/openai-node.git",
            "https://github.com/openai/openai-go.git",
            "https://github.com/openai/openai-java.git",
            "https://github.com/openai/openai-ruby.git",
            "https://github.com/openai/openai-dotnet.git",
            "https://github.com/openai/codex.git",
            "https://github.com/openai/openai-agents-python.git",
            "https://github.com/openai/swarm.git",
            "https://github.com/openai/openai-realtime-agents.git",
            "https://github.com/openai/openai-guardrails-python.git",
            "https://github.com/openai/tiktoken.git",
            "https://github.com/openai/whisper.git",
            "https://github.com/openai/CLIP.git",
            "https://github.com/openai/human-eval.git",
            "https://github.com/openai/simple-evals.git",
            "https://github.com/openai/frontier-evals.git",
            "https://github.com/openai/prm800k.git",
            "https://github.com/openai/model_spec.git",
            "https://github.com/openai/evals.git",
        ),
        ref="HEAD",
        license="mixed: Apache-2.0, MIT, CC0-1.0 and NOASSERTION",
        boundary="source_sync_and_router_inputs",
        build_kind="organization_source_sync",
        commands=(),
        smoke=(("test", "-d", "{source_root}"),),
        outputs=("OpenAI selected AI source snapshot",),
        notes=(
            "This is a selected organization source inventory, not a blanket runtime import of every OpenAI repository.",
            "SDK/API sources inform ModelRouter and InferenceRouter adapters; business logic must not call providers directly.",
            "Eval and model spec sources inform Evaluator and RuleChecker only; they are not professional compliance proof by themselves.",
            "Archived, GPL, unknown-license or NOASSERTION repositories remain isolated, licensed-gated or blocked before runtime use.",
        ),
    ),
    "trimble-licensed-sdk": SourceBuildProject(
        id="trimble-licensed-sdk",
        label="Trimble/Tekla licensed source adapter",
        source_urls=(),
        ref="HEAD",
        license="licensed",
        boundary="licensed_adapter_required",
        build_kind="licensed_source",
        source_url_env="ARCHITOKEN_TRIMBLE_SOURCE_URL",
        required_env=("ARCHITOKEN_TRIMBLE_SOURCE_URL", "TRIMBLE_LICENSE_ACK"),
        commands=(
            ("cmake", "-S", "{source}", "-B", "{build}", "-DCMAKE_BUILD_TYPE=Release", "-DCMAKE_INSTALL_PREFIX={prefix}"),
            ("cmake", "--build", "{build}", "--parallel", "{jobs}"),
            ("cmake", "--install", "{build}"),
        ),
        smoke=(("test", "-d", "{prefix}"),),
        outputs=("licensed Tekla/Trimble adapter binaries",),
        notes=("The organization URL is not a cloneable runtime. Provide an authorized repo/archive URL before building.",),
    ),
}


class SourceBuildError(RuntimeError):
    """Raised when a source build cannot proceed."""


def project_plan(project: SourceBuildProject) -> dict[str, object]:
    """Return a JSON-safe build plan."""

    return {
        **asdict(project),
        "resolvedSourceUrls": list(resolve_source_urls(project, allow_missing=True)),
    }


def resolve_source_urls(project: SourceBuildProject, *, allow_missing: bool = False) -> tuple[str, ...]:
    """Resolve source URLs, including licensed URLs supplied by env."""

    if project.source_url_env:
        value = os.getenv(project.source_url_env, "").strip()
        if value:
            return (value,)
        if allow_missing:
            return ()
        raise SourceBuildError(
            f"{project.id} requires {project.source_url_env}; no authorized source URL was provided"
        )
    return project.source_urls


def build_project(
    project_id: str,
    *,
    root: Path = DEFAULT_ROOT,
    jobs: int | None = None,
    dry_run: bool = False,
    smoke: bool = True,
) -> dict[str, object]:
    """Clone, build and optionally smoke-check one project."""

    project = SOURCE_BUILD_PROJECTS[project_id]
    jobs = jobs or max(1, os.cpu_count() or 1)
    project_root = root / project.id
    source_root = project_root / "src"
    build_dir = project_root / "build"
    prefix = project_root / "prefix"
    evidence_path = project_root / "source-build-evidence.json"
    executed: list[dict[str, object]] = []

    try:
        missing = [name for name in project.required_env if not os.getenv(name)]
        if missing and not dry_run:
            raise SourceBuildError(f"{project.id} requires environment variables: {', '.join(missing)}")

        source_urls = resolve_source_urls(project, allow_missing=dry_run)
        if not source_urls:
            source_root.mkdir(parents=True, exist_ok=True)
            executed.append(
                {
                    "status": "completed",
                    "reason": "no source checkout required",
                    "build_kind": project.build_kind,
                }
            )
        else:
            for index, url in enumerate(source_urls):
                checkout = source_root if len(source_urls) == 1 else source_root / repo_dir_name(url, index)
                executed.append(ensure_checkout(url, project.ref, checkout, dry_run=dry_run))

        for command in project.commands:
            executed.append(
                run_command(
                    command,
                    cwd=source_root,
                    source=source_root,
                    build=build_dir,
                    prefix=prefix,
                    source_root=source_root,
                    jobs=jobs,
                    dry_run=dry_run,
                )
            )

        if smoke:
            for command in project.smoke:
                executed.append(
                    run_command(
                        command,
                        cwd=source_root,
                        source=source_root,
                        build=build_dir,
                        prefix=prefix,
                        source_root=source_root,
                        jobs=jobs,
                        dry_run=dry_run,
                        smoke=True,
                    )
                )
    except subprocess.CalledProcessError as exc:
        evidence = build_evidence(
            project,
            project_root=project_root,
            source_root=source_root,
            build_dir=build_dir,
            prefix=prefix,
            dry_run=dry_run,
            jobs=jobs,
            steps=executed,
            status="failed",
            error={
                "type": "CalledProcessError",
                "returncode": exc.returncode,
                "command": list(exc.cmd) if isinstance(exc.cmd, (list, tuple)) else str(exc.cmd),
            },
        )
        write_evidence(evidence, evidence_path=evidence_path, dry_run=dry_run)
        raise SourceBuildError(f"{project.id} source build failed with exit code {exc.returncode}") from exc
    except SourceBuildError as exc:
        evidence = build_evidence(
            project,
            project_root=project_root,
            source_root=source_root,
            build_dir=build_dir,
            prefix=prefix,
            dry_run=dry_run,
            jobs=jobs,
            steps=executed,
            status="failed",
            error={"type": "SourceBuildError", "message": str(exc)},
        )
        write_evidence(evidence, evidence_path=evidence_path, dry_run=dry_run)
        raise

    evidence = build_evidence(
        project,
        project_root=project_root,
        source_root=source_root,
        build_dir=build_dir,
        prefix=prefix,
        dry_run=dry_run,
        jobs=jobs,
        steps=executed,
        status="completed" if not dry_run else "dry_run",
    )
    write_evidence(evidence, evidence_path=evidence_path, dry_run=dry_run)
    return evidence


def build_evidence(
    project: SourceBuildProject,
    *,
    project_root: Path,
    source_root: Path,
    build_dir: Path,
    prefix: Path,
    dry_run: bool,
    jobs: int,
    steps: list[dict[str, object]],
    status: str,
    error: dict[str, object] | None = None,
) -> dict[str, object]:
    """Create a source-build evidence payload."""

    evidence = {
        "schema": "architoken.source-build-evidence.v1",
        "project": project_plan(project),
        "root": str(project_root),
        "sourceRoot": str(source_root),
        "buildDir": str(build_dir),
        "prefix": str(prefix),
        "dryRun": dry_run,
        "jobs": jobs,
        "status": status,
        "steps": steps,
    }
    if error:
        evidence["error"] = error
    return evidence


def write_evidence(evidence: dict[str, object], *, evidence_path: Path, dry_run: bool) -> None:
    """Write evidence for completed and failed real builds."""

    evidence["evidencePath"] = str(evidence_path)
    if not dry_run:
        evidence_path.parent.mkdir(parents=True, exist_ok=True)
        evidence_path.write_text(json.dumps(evidence, indent=2, sort_keys=True), encoding="utf-8")


def ensure_checkout(url: str, ref: str, checkout: Path, *, dry_run: bool) -> dict[str, object]:
    """Clone or update one source checkout."""

    if dry_run:
        return {"status": "dry_run", "command": git_network_command("clone", "--recursive", url, str(checkout)), "ref": ref}
    checkout.parent.mkdir(parents=True, exist_ok=True)
    if not (checkout / ".git").exists():
        preserve_checkout(checkout)
        clone_checkout(url, checkout)
        checkout_status = "completed"
    else:
        checkout_status = "completed"
        try:
            run_with_retries(git_network_command("fetch", "--tags", "--recurse-submodules"), cwd=checkout)
        except subprocess.CalledProcessError as exc:
            if not has_git_head(checkout):
                raise
            checkout_status = f"fetch_failed_used_existing_checkout:{exc.returncode}"
    if ref != "HEAD":
        try:
            run(["git", "checkout", ref], cwd=checkout)
        except subprocess.CalledProcessError:
            preserve_checkout(checkout)
            clone_checkout(url, checkout)
            run(["git", "checkout", ref], cwd=checkout)
            checkout_status = "recloned_after_checkout_failure"
    run_with_retries(git_network_command("submodule", "update", "--init", "--recursive", "--force"), cwd=checkout)
    commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=checkout, text=True).strip()
    return {"status": checkout_status, "url": url, "checkout": str(checkout), "ref": ref, "commit": commit}


def clone_checkout(url: str, checkout: Path) -> None:
    """Clone one checkout with the repository's network settings."""

    run_with_retries(git_network_command("clone", "--recursive", url, str(checkout)), cwd=checkout.parent)


def git_network_command(*args: str) -> list[str]:
    """Return a Git command that avoids stale local proxy settings."""

    return ["git", "-c", "http.version=HTTP/1.1", "-c", "http.proxy=", "-c", "https.proxy=", *args]


def preserve_checkout(checkout: Path) -> None:
    """Move an unusable generated checkout aside instead of deleting it."""

    if checkout.exists():
        suffix = int(time.time())
        failed = checkout.with_name(f"{checkout.name}.partial-{suffix}")
        while failed.exists():
            suffix += 1
            failed = checkout.with_name(f"{checkout.name}.partial-{suffix}")
        checkout.rename(failed)


def run_command(
    command: tuple[str, ...],
    *,
    cwd: Path,
    source: Path,
    build: Path,
    prefix: Path,
    source_root: Path,
    jobs: int,
    dry_run: bool,
    smoke: bool = False,
) -> dict[str, object]:
    """Run one rendered build command."""

    rendered = [render_token(token, source=source, build=build, prefix=prefix, source_root=source_root, jobs=jobs) for token in command]
    if dry_run:
        return {"status": "dry_run", "smoke": smoke, "command": rendered, "cwd": str(cwd)}
    build.mkdir(parents=True, exist_ok=True)
    prefix.mkdir(parents=True, exist_ok=True)
    run(rendered, cwd=cwd, build=build, prefix=prefix)
    return {"status": "completed", "smoke": smoke, "command": rendered, "cwd": str(cwd)}


def render_token(
    token: str,
    *,
    source: Path,
    build: Path,
    prefix: Path,
    source_root: Path,
    jobs: int,
) -> str:
    """Render path/env placeholders in one command token."""

    rendered = (
        token.replace("{source}", str(source))
        .replace("{build}", str(build))
        .replace("{prefix}", str(prefix))
        .replace("{source_root}", str(source_root))
        .replace("{jobs}", str(jobs))
    )
    while "{env:" in rendered:
        start = rendered.index("{env:")
        end = rendered.index("}", start)
        name = rendered[start + 5 : end]
        rendered = rendered[:start] + os.getenv(name, "") + rendered[end + 1 :]
    return rendered


def run(command: list[str], *, cwd: Path, build: Path | None = None, prefix: Path | None = None) -> None:
    """Run a subprocess command with explicit argv."""

    env = os.environ.copy()
    for proxy_key in ("http_proxy", "https_proxy", "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "all_proxy"):
        env.pop(proxy_key, None)
    env["GIT_CONFIG_COUNT"] = "2"
    env["GIT_CONFIG_KEY_0"] = "http.proxy"
    env["GIT_CONFIG_VALUE_0"] = ""
    env["GIT_CONFIG_KEY_1"] = "https.proxy"
    env["GIT_CONFIG_VALUE_1"] = ""
    library_dirs: list[str] = []
    for base in (build, prefix):
        if base:
            for relative in ("install/lib", "install/lib64", "lib", "lib64"):
                candidate = base / relative
                if candidate.exists():
                    library_dirs.append(str(candidate))
    opencascade_dir = env.get("OpenCASCADE_DIR")
    if opencascade_dir:
        library_dirs.append(str(Path(opencascade_dir).parent.parent))
    python313_prefix = env.get("ARCHITOKEN_PYTHON313_PREFIX")
    if python313_prefix:
        library_dirs.append(str(Path(python313_prefix) / "lib"))
    if library_dirs:
        current_library_path = env.get("LD_LIBRARY_PATH")
        env["LD_LIBRARY_PATH"] = (
            f"{':'.join(library_dirs)}:{current_library_path}" if current_library_path else ":".join(library_dirs)
        )
    is_source_git = command and command[0] == "git"
    if is_source_git:
        env["GIT_LFS_SKIP_SMUDGE"] = "1"
    is_source_build_npm = command and command[0] in {"npm", "npx", "bash"}
    if is_source_build_npm:
        env["CI"] = env.get("CI", "1")
        env["HUSKY"] = env.get("HUSKY", "0")
        env["PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD"] = env.get("PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD", "1")
        env["PUPPETEER_SKIP_DOWNLOAD"] = env.get("PUPPETEER_SKIP_DOWNLOAD", "1")
        env["npm_config_audit"] = env.get("npm_config_audit", "false")
        env["npm_config_fund"] = env.get("npm_config_fund", "false")
        env["npm_config_legacy_peer_deps"] = env.get("npm_config_legacy_peer_deps", "true")
    subprocess.run(command, cwd=cwd, check=True, env=env)


def has_git_head(checkout: Path) -> bool:
    """Return whether an existing checkout has a usable HEAD commit."""

    return subprocess.run(
        ["git", "rev-parse", "--verify", "HEAD"],
        cwd=checkout,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    ).returncode == 0


def run_with_retries(command: list[str], *, cwd: Path, attempts: int = 3) -> None:
    """Run a network-prone source command with bounded retries."""

    last_error: subprocess.CalledProcessError | None = None
    for attempt in range(1, attempts + 1):
        try:
            run(command, cwd=cwd)
            return
        except subprocess.CalledProcessError as exc:
            last_error = exc
            if attempt == attempts:
                break
            time.sleep(5 * attempt)
    if last_error:
        raise last_error


def repo_dir_name(url: str, index: int) -> str:
    """Return a stable checkout directory name for a git URL."""

    base = url.rstrip("/").rsplit("/", 1)[-1]
    if base.endswith(".git"):
        base = base[:-4]
    return base or f"repo-{index + 1}"


def selected_projects(values: Iterable[str]) -> list[str]:
    """Expand project selectors."""

    result: list[str] = []
    for value in values:
        if value == "all":
            result.extend(SOURCE_BUILD_PROJECTS)
        else:
            if value not in SOURCE_BUILD_PROJECTS:
                raise SourceBuildError(f"unknown source-build project: {value}")
            result.append(value)
    return list(dict.fromkeys(result))


def main(argv: list[str] | None = None) -> int:
    """CLI entrypoint."""

    parser = argparse.ArgumentParser(description="ArchIToken source-build adapter CLI")
    parser.add_argument("command", choices=["list", "plan", "build"])
    parser.add_argument("projects", nargs="*", default=["all"])
    parser.add_argument("--root", type=Path, default=DEFAULT_ROOT)
    parser.add_argument("--jobs", type=int, default=max(1, os.cpu_count() or 1))
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--no-smoke", action="store_true")
    args = parser.parse_args(argv)

    try:
        project_ids = selected_projects(args.projects)
        if args.command == "list":
            print(json.dumps([project_plan(SOURCE_BUILD_PROJECTS[item]) for item in project_ids], indent=2, sort_keys=True))
            return 0
        if args.command == "plan":
            print(json.dumps({item: project_plan(SOURCE_BUILD_PROJECTS[item]) for item in project_ids}, indent=2, sort_keys=True))
            return 0
        results = {
            item: build_project(
                item,
                root=args.root,
                jobs=args.jobs,
                dry_run=args.dry_run,
                smoke=not args.no_smoke,
            )
            for item in project_ids
        }
        print(json.dumps(results, indent=2, sort_keys=True))
        return 0
    except SourceBuildError as exc:
        print(json.dumps({"status": "failed", "error": str(exc)}, sort_keys=True), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
