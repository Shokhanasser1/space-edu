import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { gpuCaps } from '../textures';

/**
 * The one thing the DOM side needs from inside the Canvas: the camera and
 * the viewport size, for projecting body positions onto the screen. A module
 * object rather than React state — it is read in a frame loop.
 */
export const sceneBridge = { camera: null, width: 0, height: 0 };

export function SceneBridge() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    gpuCaps.maxTextureSize = gl?.capabilities?.maxTextureSize || 4096;
  }, [gl]);
  useEffect(() => {
    sceneBridge.camera = camera;
    sceneBridge.width = size.width;
    sceneBridge.height = size.height;
    return () => {
      if (sceneBridge.camera === camera) sceneBridge.camera = null;
    };
  }, [camera, size.width, size.height]);
  return null;
}
