#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

int main(int argc, char **argv) {
  const char *panai_bin = "/home/insome/.local/bin/PanAI-bin";

  setenv("WEBKIT_DISABLE_DMABUF_RENDERER", "1", 1);
  setenv("WEBKIT_DISABLE_COMPOSITING_MODE", "1", 1);
  setenv("LIBGL_ALWAYS_SOFTWARE", "1", 1);

  char **child_argv = calloc((size_t)argc + 1, sizeof(char *));
  if (child_argv == NULL) {
    fprintf(stderr, "PanAI launcher: allocation failed\n");
    return 127;
  }

  child_argv[0] = (char *)panai_bin;
  for (int index = 1; index < argc; index += 1) {
    child_argv[index] = argv[index];
  }

  execv(panai_bin, child_argv);
  fprintf(stderr, "PanAI launcher: failed to exec %s: %s\n", panai_bin, strerror(errno));
  free(child_argv);
  return 127;
}
