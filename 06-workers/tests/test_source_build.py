from __future__ import annotations

import json
import os

import pytest

from architoken_workers.source_build import (
    SOURCE_BUILD_PROJECTS,
    SourceBuildError,
    SourceBuildProject,
    build_project,
    project_plan,
    resolve_source_urls,
)


def test_source_build_manifest_covers_required_heavy_adapters() -> None:
    required = {
        "blender",
        "python-3-13",
        "sse2neon",
        "opencolorio",
        "tree-sitter",
        "nvidia-cuda-toolchain",
        "intel-oneapi-toolchain",
        "intel-llvm-oneapi",
        "bonsai",
        "ifcopenshell",
        "occt",
        "occt-7-9-1",
        "libredwg",
        "freecad",
        "rhino3dm",
        "opennurbs",
        "cgal",
        "cgal-swig-bindings",
        "emsdk",
        "thatopen-engine-web-ifc",
        "thatopen-web-ifc-three",
        "thatopen-web-ifc-viewer",
        "microsoft-ifc",
        "ddc-cad2data-revit-ifc-dwg-dgn",
        "ddc-openconstructionerp",
        "ddc-skills-construction",
        "ddc-cad-bim-code-pipeline",
        "ddc-n8n-project-management",
        "ddc-openconstructionestimate",
        "louistrue-ifc5cad",
        "louistrue-ifcliteviewer",
        "buildingsmart-standards",
        "opencascade-sas-org-source-sync",
        "cgal-org-source-sync",
        "forgecad",
        "ifcdb-agent",
        "cesium",
        "speckle-sharp",
        "specklesystems-org-source-sync",
        "openai-symphony-source-sync",
        "openai-ai-source-sync",
        "trimble-licensed-sdk",
    }

    assert required.issubset(SOURCE_BUILD_PROJECTS)
    for project_id in required:
        plan = project_plan(SOURCE_BUILD_PROJECTS[project_id])
        assert plan["boundary"]
        assert plan["build_kind"]
        assert plan["license"]


def test_source_build_dry_run_records_commands_without_network(tmp_path) -> None:
    result = build_project(
        "occt",
        root=tmp_path,
        jobs=2,
        dry_run=True,
        smoke=True,
    )

    commands = [step.get("command") for step in result["steps"]]
    assert [
        "git",
        "-c",
        "http.version=HTTP/1.1",
        "-c",
        "http.proxy=",
        "-c",
        "https.proxy=",
        "clone",
        "--recursive",
        "https://github.com/Open-Cascade-SAS/OCCT.git",
        str(tmp_path / "occt" / "src"),
    ] in commands
    assert any(command and command[0] == "cmake" for command in commands)
    assert result["dryRun"] is True


def test_buildingsmart_is_standards_source_sync_not_fake_monolithic_binary() -> None:
    project = SOURCE_BUILD_PROJECTS["buildingsmart-standards"]

    assert project.build_kind == "standards_sync"
    assert len(project.source_urls) >= 20
    assert not project.commands
    assert "buildingSMART/IDS.git" in " ".join(project.source_urls)


def test_openai_sources_stay_router_inputs_not_project_identity() -> None:
    symphony = SOURCE_BUILD_PROJECTS["openai-symphony-source-sync"]
    organization = SOURCE_BUILD_PROJECTS["openai-ai-source-sync"]

    assert symphony.source_urls == ("https://github.com/openai/symphony.git",)
    assert symphony.license == "Apache-2.0"
    assert symphony.boundary == "source_sync_and_isolated_workflow_service"
    assert symphony.build_kind == "source_sync"
    assert any("WorkflowRouter" in note for note in symphony.notes)

    assert organization.build_kind == "organization_source_sync"
    assert "https://github.com/openai/openai-openapi.git" in organization.source_urls
    assert "https://github.com/openai/openai-python.git" in organization.source_urls
    assert "https://github.com/openai/codex.git" in organization.source_urls
    assert any("ModelRouter" in note for note in organization.notes)
    assert any("InferenceRouter" in note for note in organization.notes)
    assert all("project identity" not in note for note in organization.notes)


def test_dry_run_is_not_completion_evidence() -> None:
    project = SOURCE_BUILD_PROJECTS["thatopen-engine-web-ifc"]

    assert project.build_kind == "emscripten_npm"
    assert "EMSDK" in project.required_env
    assert "dry-run output is not accepted" in " ".join(project.notes)


def test_heavy_cmake_builds_resume_instead_of_wiping_workdirs() -> None:
    for project_id in ("ifcopenshell", "freecad", "blender"):
        commands = SOURCE_BUILD_PROJECTS[project_id].commands
        assert ("cmake", "-E", "remove_directory", "{build}") not in commands


def test_blender_uses_real_arm64_source_cmake_route_not_precompiled_update() -> None:
    project = SOURCE_BUILD_PROJECTS["blender"]
    flat_commands = [" ".join(command) for command in project.commands]

    assert project.build_kind == "cmake_headless"
    assert project.required_env == ("ARCHITOKEN_PYTHON313_PREFIX", "SSE2NEON_INCLUDE_DIR", "OPENCOLORIO_DIR")
    assert all("make update" not in command for command in flat_commands)
    assert any("-DCMAKE_C_COMPILER=/usr/bin/gcc-14" in command for command in flat_commands)
    assert any("-DCMAKE_CXX_COMPILER=/usr/bin/g++-14" in command for command in flat_commands)
    assert any("-DWITH_LIBS_PRECOMPILED=OFF" in command for command in flat_commands)
    assert any("-DPYTHON_ROOT_DIR={env:ARCHITOKEN_PYTHON313_PREFIX}" in command for command in flat_commands)
    assert any("-DPYTHON_VERSION=3.13" in command for command in flat_commands)
    assert any("-DSSE2NEON_INCLUDE_DIR={env:SSE2NEON_INCLUDE_DIR}" in command for command in flat_commands)
    assert any("-DOpenColorIO_DIR={env:OPENCOLORIO_DIR}" in command for command in flat_commands)
    assert any("-DWITH_VULKAN_BACKEND=OFF" in command for command in flat_commands)
    assert any("blender_headless.cmake" in command for command in flat_commands)
    assert any("namespace OpenImageIO = OIIO" in command for command in flat_commands)
    assert any("Strutil::strhash(value.size(), value.data())" in command for command in flat_commands)
    assert any("static const UString ustr" in command for command in flat_commands)
    assert any("formatter<blender::UString, char>" in command for command in flat_commands)
    assert any("valid_file(&mem_reader)" in command and "in->open" in command for command in flat_commands)
    assert any("fmt::basic_runtime<char>" in command for command in flat_commands)
    assert any("fmt::println" in command and "fmt::print" in command for command in flat_commands)
    assert ("cmake", "-E", "remove_directory", "{build}") not in project.commands


def test_python_313_source_toolchain_is_required_for_blender() -> None:
    project = SOURCE_BUILD_PROJECTS["python-3-13"]
    flat_commands = [" ".join(command) for command in project.commands]

    assert project.source_urls == ("https://github.com/python/cpython.git",)
    assert project.ref == "v3.13.13"
    assert any("--enable-shared" in command for command in flat_commands)
    assert any("LDFLAGS=-Wl,-rpath,{prefix}/lib" in command for command in flat_commands)
    assert project.smoke == (("{prefix}/bin/python3.13", "--version"),)


def test_sse2neon_header_is_source_built_for_blender_arm64() -> None:
    project = SOURCE_BUILD_PROJECTS["sse2neon"]

    assert project.source_urls == ("https://github.com/DLTcollab/sse2neon.git",)
    assert project.build_kind == "header_only"
    assert ("cmake", "-E", "copy", "{source}/sse2neon.h", "{prefix}/include/sse2neon.h") in project.commands
    assert project.smoke == (("test", "-f", "{prefix}/include/sse2neon.h"),)


def test_opencolorio_source_build_replaces_broken_system_cmake_target() -> None:
    project = SOURCE_BUILD_PROJECTS["opencolorio"]
    flat_commands = [" ".join(command) for command in project.commands]

    assert project.source_urls == ("https://github.com/AcademySoftwareFoundation/OpenColorIO.git",)
    assert project.build_kind == "cmake"
    assert any("-DOCIO_BUILD_TESTS=OFF" in command for command in flat_commands)
    assert any("-DOCIO_BUILD_PYTHON=OFF" in command for command in flat_commands)
    assert project.smoke == (("test", "-f", "{prefix}/lib/cmake/OpenColorIO/OpenColorIOConfig.cmake"),)


def test_tree_sitter_source_build_is_pinned_for_code_intelligence() -> None:
    project = SOURCE_BUILD_PROJECTS["tree-sitter"]
    flat_commands = [" ".join(command) for command in project.commands]

    assert project.source_urls == ("https://github.com/tree-sitter/tree-sitter.git",)
    assert project.ref == "v0.26.9"
    assert project.license == "MIT"
    assert project.boundary == "source_build_worker_or_wasm_parser"
    assert any("cargo install" in command for command in flat_commands)
    assert project.smoke == (("{prefix}/bin/tree-sitter", "--version"),)
    assert "code/config syntax trees" in " ".join(project.notes)


def test_cuda_toolchain_smoke_is_real_runtime_evidence_not_documentation() -> None:
    project = SOURCE_BUILD_PROJECTS["nvidia-cuda-toolchain"]
    flat_commands = [" ".join(command) for command in project.commands]

    assert project.build_kind == "cuda_smoke"
    assert project.boundary == "nvidia_certified_gpu_toolchain"
    assert project.ref == "12.9.2-cudnn-devel-ubuntu24.04"
    assert any("/usr/local/cuda/bin/nvcc" in command for command in flat_commands)
    assert project.smoke == (("/usr/bin/nvidia-smi",), ("{prefix}/bin/architoken-cuda-smoke",))
    notes = " ".join(project.notes)
    assert "NGC signed CUDA/CUDA-DL image tag or digest" in notes
    assert "must fail and record evidence" in notes
    assert "compatibility bypasses" in notes


def test_intel_oneapi_toolchain_smoke_is_real_runtime_evidence() -> None:
    project = SOURCE_BUILD_PROJECTS["intel-oneapi-toolchain"]
    flat_commands = [" ".join(command) for command in project.commands]

    assert project.build_kind == "oneapi_sycl_smoke"
    assert any("command -v icpx" in command and "command -v dpcpp" in command for command in flat_commands)
    assert any("-fsycl" in command for command in flat_commands)
    assert project.smoke == (("{prefix}/bin/architoken-oneapi-smoke",),)
    assert "usable SYCL device is missing" in " ".join(project.notes)


def test_intel_llvm_oneapi_source_build_targets_arm_and_native_cpu() -> None:
    project = SOURCE_BUILD_PROJECTS["intel-llvm-oneapi"]
    flat_commands = [" ".join(command) for command in project.commands]

    assert project.source_urls == ("https://github.com/intel/llvm.git",)
    assert project.ref == "sycl"
    assert project.build_kind == "dpcpp_source_toolchain"
    assert any("--host-target AArch64;ARM;X86" in command for command in flat_commands)
    assert any("--native_cpu" in command for command in flat_commands)
    assert any("deploy-sycl-toolchain" in command for command in flat_commands)
    assert any("-fsycl" in command for command in flat_commands)
    assert any("-fsycl-targets=native_cpu" in command for command in flat_commands)
    assert any("-Wl,-rpath,'{build}/install/lib'" in command for command in flat_commands)
    assert ("{build}/bin/clang++", "--version") in project.smoke


def test_ifcopenshell_uses_occt_kernel_without_blocking_on_cgal() -> None:
    project = SOURCE_BUILD_PROJECTS["ifcopenshell"]
    flat_commands = [" ".join(command) for command in project.commands]

    assert "OpenCASCADE_DIR" in project.required_env
    assert "CGAL_DIR" not in project.required_env
    assert any("-DPYTHON_EXECUTABLE=/usr/bin/python3" in command for command in flat_commands)
    assert any("-DPYTHON_MODULE_INSTALL_DIR={prefix}/lib/python3.12/site-packages" in command for command in flat_commands)
    assert any("-DWITH_CGAL=OFF" in command for command in flat_commands)
    assert any("-DWITH_OPENCASCADE=ON" in command for command in flat_commands)
    assert any("OpaqueCoordinate" in command and "std::enable_if_t" in command for command in flat_commands)


def test_freecad_headless_route_disables_cam_gui_simulator() -> None:
    project = SOURCE_BUILD_PROJECTS["freecad"]
    flat_commands = [" ".join(command) for command in project.commands]

    assert any("-DBUILD_GUI=OFF" in command for command in flat_commands)
    assert any("-DBUILD_ASSEMBLY=OFF" in command for command in flat_commands)
    assert any("-DBUILD_BIM=OFF" in command for command in flat_commands)
    assert any("-DBUILD_CAM=OFF" in command for command in flat_commands)
    assert any("-DBUILD_TECHDRAW=OFF" in command for command in flat_commands)
    assert any("-DBUILD_DRAFT=OFF" in command for command in flat_commands)
    assert any("-DBUILD_DRAWING=OFF" in command for command in flat_commands)
    assert any("-DBUILD_OPENSCAD=OFF" in command for command in flat_commands)
    assert any("-DBUILD_SPREADSHEET=OFF" in command for command in flat_commands)
    assert any("-DPython3_EXECUTABLE=/usr/bin/python3" in command for command in flat_commands)
    assert any("-DBUILD_TEST=OFF" in command for command in flat_commands)
    assert any("-DENABLE_DEVELOPER_TESTS=OFF" in command for command in flat_commands)
    assert any("-DINSTALL_TO_SITEPACKAGES=OFF" in command for command in flat_commands)


def test_cgal_core_is_not_replaced_by_swig_bindings() -> None:
    cgal = SOURCE_BUILD_PROJECTS["cgal"]
    bindings = SOURCE_BUILD_PROJECTS["cgal-swig-bindings"]
    flat_commands = [" ".join(command) for command in bindings.commands]

    assert cgal.source_urls == ("https://github.com/CGAL/cgal.git",)
    assert bindings.source_urls == ("https://github.com/CGAL/cgal-swig-bindings.git",)
    assert bindings.required_env == ("CGAL_DIR",)
    assert ("cmake", "-E", "remove_directory", "{build}") not in bindings.commands
    assert any("-DPython_EXECUTABLE=/usr/bin/python3" in command for command in flat_commands)


def test_ifcliteviewer_pins_powerbi_packager_and_patches_api_detection() -> None:
    project = SOURCE_BUILD_PROJECTS["louistrue-ifcliteviewer"]
    flat_commands = [" ".join(command) for command in project.commands]

    assert any("powerbi-visuals-tools@5.3.0" in command for command in flat_commands)
    assert any("ajv@8.20.0" in command for command in flat_commands)
    assert any("this.pbiviz.apiVersion" in command for command in flat_commands)
    assert ("npm", "run", "package") in project.commands
    assert project.smoke == (("test", "-d", "{source}/dist"),)


def test_trimble_requires_authorized_source_url(monkeypatch) -> None:
    project = SOURCE_BUILD_PROJECTS["trimble-licensed-sdk"]
    monkeypatch.delenv("ARCHITOKEN_TRIMBLE_SOURCE_URL", raising=False)

    assert resolve_source_urls(project, allow_missing=True) == ()

    monkeypatch.setenv("ARCHITOKEN_TRIMBLE_SOURCE_URL", "https://github.com/TrimbleSolutionsCorporation/example.git")
    monkeypatch.setenv("TRIMBLE_LICENSE_ACK", "accepted")
    assert resolve_source_urls(project) == (
        "https://github.com/TrimbleSolutionsCorporation/example.git",
    )


def test_failed_real_build_writes_failure_evidence(tmp_path) -> None:
    project = SourceBuildProject(
        id="failure-probe",
        label="failure evidence probe",
        source_urls=(),
        ref="HEAD",
        license="NOASSERTION",
        boundary="test_only",
        build_kind="test",
        commands=(("python3", "-c", "raise SystemExit(7)"),),
    )
    SOURCE_BUILD_PROJECTS[project.id] = project
    (tmp_path / project.id / "src").mkdir(parents=True)

    try:
        with pytest.raises(SourceBuildError):
            build_project(project.id, root=tmp_path, dry_run=False, smoke=False)
    finally:
        SOURCE_BUILD_PROJECTS.pop(project.id, None)

    evidence_path = tmp_path / project.id / "source-build-evidence.json"
    evidence = json.loads(evidence_path.read_text())
    assert evidence["dryRun"] is False
    assert evidence["status"] == "failed"
    assert evidence["error"]["type"] == "CalledProcessError"
    assert evidence["error"]["returncode"] == 7
