# Paper Moon Android startup architecture — build 133

1. Android displays only the solid `#FFF8F5` native splash background; no separate logo/moon is visible.
2. `preventAutoHideAsync()` is requested at module load.
3. The root Stack mounts immediately, then local route resolution occurs while the native splash is held.
4. After the root Stack has rendered two native frames, the Paper Moon animation is allowed to start. A 1.6-second root-frame watchdog prevents router recovery from blocking it indefinitely.
5. `Asset.loadAsync`, successful `Image.onLoad` for all five layers, and root layout must all be ready. If Android skips an image decode event, a 1.6-second watchdog changes missing layers to the calm native fallback.
6. The native splash is hidden with retry plus synchronous fallback. If it was already hidden or its native call fails/times out, the React Paper Moon scene continues instead of being cancelled.
7. Reanimated starts on the following frame.
8. Thread height is derived from the live moon position.
9. The same selected route becomes interactive after the overlay is removed.
10. A failed visual asset gets one retry, then falls back to a calm native scene that remains visible for at least 1.9 seconds.
