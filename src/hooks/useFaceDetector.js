import { useEffect, useRef, useState } from 'react'
import * as Blazeface from "@tensorflow-models/blazeface";
import * as tf from "@tensorflow/tfjs-core";
import * as tfjsWasm from "@tensorflow/tfjs-backend-wasm";

tfjsWasm.setWasmPaths(
  `https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@${tfjsWasm.version_wasm}/dist/`
);
tf.setBackend("wasm");

export const useFaceDetector = (vdo) => {
  /*
   * Face detection effect
   * Steps:
   * - Detect whether there are any face(s) inside capture frame
   * - IF there are turn `isFaceDetect` value to `true`
   * - If not show error ring (red ring)
   *
   * Notes:
   * - Face detection should be running in the background and error ring
   *  should shown up even when user is on face capturing step
   * - When ever error ring is shown up user need to do current step again
   *  from the beginning
   */

  const [isReady, setReady] = useState(false);
  const [isFaceDetected, setFaceDetected] = useState(false);
  const faceModel = useRef();

  useEffect(() => {
    Blazeface.load().then((model) => {
      faceModel.current = model;
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (isReady) {
      /*
       * Face detection model is detecting every 200ms (5 fps)
       */
      setInterval(() => {
        faceModel.current.estimateFaces(vdo, false).then((prediction) => {
          setFaceDetected(
            prediction.length ? prediction[0].probability > 0.95 : false
          );
        });
      }, 200);
    }
  }, [isReady, vdo]);

  return [{ isFaceDetected }];
};

export default useFaceDetector