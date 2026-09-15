// Real independent Node-API addon used to verify per-module instance-data isolation.
#include <node_api.h>
#include <cstdint>
#include <new>
struct SlotData { uint32_t token; uint64_t padding[8]; };
static void Finalize(napi_env, void* pointer, void*) { delete static_cast<SlotData*>(pointer); }
static napi_value State(napi_env env, SlotData* owned) {
  void* current = nullptr; napi_value object, matches, token;
  if (napi_get_instance_data(env, &current) != napi_ok || napi_create_object(env, &object) != napi_ok ||
      napi_get_boolean(env, current == owned, &matches) != napi_ok || napi_create_uint32(env, owned->token, &token) != napi_ok ||
      napi_set_named_property(env, object, "ownsSlot", matches) != napi_ok || napi_set_named_property(env, object, "token", token) != napi_ok) {
    napi_throw_error(env, nullptr, "slot probe: unable to observe own instance data"); return nullptr;
  }
  return object;
}
static napi_value Check(napi_env env, napi_callback_info info) {
  void* data = nullptr;
  if (napi_get_cb_info(env, info, nullptr, nullptr, nullptr, &data) != napi_ok) return nullptr;
  return State(env, static_cast<SlotData*>(data));
}
static napi_value Replace(napi_env env, napi_callback_info info) {
  void* pointer = nullptr; size_t count = 1; napi_value values[1]; uint32_t token;
  if (napi_get_cb_info(env, info, &count, values, nullptr, &pointer) != napi_ok || count != 1 ||
      napi_get_value_uint32(env, values[0], &token) != napi_ok) {
    napi_throw_type_error(env, nullptr, "slot probe: replacement requires one numeric token"); return nullptr;
  }
  auto* owned = static_cast<SlotData*>(pointer);
  // Re-register the same allocation: replacing instance data does not run its previous finalizer.
  if (napi_set_instance_data(env, owned, Finalize, nullptr) != napi_ok) return nullptr;
  owned->token = token;
  return State(env, owned);
}
static napi_value Initialize(napi_env env, napi_value exports) {
  auto* owned = new (std::nothrow) SlotData{}; if (!owned) return nullptr;
  owned->token = 12345;
  if (napi_set_instance_data(env, owned, Finalize, nullptr) != napi_ok) { delete owned; return nullptr; }
  napi_property_descriptor methods[] = {
    {"check", nullptr, Check, nullptr, nullptr, nullptr, napi_default, owned},
    {"replace", nullptr, Replace, nullptr, nullptr, nullptr, napi_default, owned}
  };
  if (napi_define_properties(env, exports, 2, methods) != napi_ok) return nullptr;
  return exports;
}
NAPI_MODULE(NODE_GYP_MODULE_NAME, Initialize)
