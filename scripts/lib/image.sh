image_ref() {
  local source="$1" platform id
  platform="$(docker version -f '{{.Server.Os}}/{{.Server.Arch}}')"
  id="$(docker image inspect "$source" --platform "$platform" -f '{{.Id}}' 2>/dev/null || docker image inspect "$source" -f '{{.Id}}')" || return 1
  id="${id#sha256:}"
  echo "${source%%:*}:${id:0:12}"
}
