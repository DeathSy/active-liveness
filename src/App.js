import { useEffect, useRef, useState } from "react";
import classNames from "classnames";
import styled, { css, keyframes } from "styled-components";

// machine learning stuff
import * as Blazeface from "@tensorflow-models/blazeface";
import * as tf from "@tensorflow/tfjs-core";
import * as tfjsWasm from "@tensorflow/tfjs-backend-wasm";

tfjsWasm.setWasmPaths(
  `https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@${tfjsWasm.version_wasm}/dist/`
);
tf.setBackend("wasm");
// end machine learning stuff

const second = 1000;
const BASE_URL = "https://ml-uat.appman.co.th";
const API_KEY = "D0VJdgq51n8Gsgs6FyjiY7Ib3qMEtWJK3Fy93BoB";
const REF_NO = "EKYC20220304070952355";

const CircularFrame = keyframes`
  to {
    stroke-dashoffset: 0;
  }
`;

const Svg = styled.svg`
  circle {
    stroke-dasharray: 2000;
    stroke-dashoffset: 2000;
    transform-origin: center;
    transform: rotate(270deg);
    animation: ${(props) =>
      props.isReady &&
      css`
        ${CircularFrame} ${(props) => props.threshold}s ease-out forwards;
      `};
    animation-delay: 0.5s;
  }
`;

// TODO: implement ekyc service
const livenessService = async (clientVdo) => {
  const body = new FormData();
  // ! need to convert to Blob to real mp4 file otherwise backend server cannot blob file metadata
  const file = new File([clientVdo], `${new Date()}.mp4`, {
    type: getSupportedRecorderMimeType(),
  });
  body.append("video", file);
  body.append("rotate", true);
  body.append("sequence", "yaw,nod");
  try {
    const request = await fetch(`${BASE_URL}/mw/e-kyc/fr-active-liveness`, {
      method: "POST",
      body,
      headers: {
        "x-api-key": API_KEY,
        "reference-number": REF_NO,
      },
    });
    return request.json();
  } catch (err) {
    console.log(err);
  }
  return true;
};

const faceComparisonService = async (base64Image) => {
  // console.log(base64Image);
  return true;
};

const initialMediaDevice = async () => {
  return navigator.mediaDevices.getUserMedia({ video: true, audio: false });
};

const getSupportedRecorderMimeType = () => {
  const mp4 = MediaRecorder.isTypeSupported("video/mp4");
  const webm = MediaRecorder.isTypeSupported("video/webm");

  if (webm) return "video/webm";

  if (mp4) return "video/mp4";
};

const useRecorder = (videoRef) => {
  const deviceRef = useRef();
  const recorder = useRef();
  const recordedBlob = useRef([]);
  const [recordedVideo, setRecordedVideo] = useState();
  const [isReady, setReady] = useState(false);
  const [isStarted, setStarted] = useState(false);

  useEffect(() => {
    initialMediaDevice().then((stream) => {
      deviceRef.current = stream;
      videoRef.current.srcObject = stream;
      setReady(true);
    });
  }, [videoRef]);

  const startRecorder = () => {
    recorder.current = new MediaRecorder(deviceRef.current, {
      videoBitsPerSecond: 2 * 1000 * 1000, // 2 Mbit/s
      mimeType: getSupportedRecorderMimeType(),
    });

    recorder.current.addEventListener("start", (e) => {
      console.log("record started");
      setStarted(true);
    });

    recorder.current.addEventListener("dataavailable", (e) => {
      recordedBlob.current.push(e.data);
      console.log("generating video record");
    });

    recorder.current.addEventListener("stop", () => {
      const recordedVideo = new Blob(recordedBlob.current, {
        type: recorder.current.mimeType,
      });
      recordedBlob.current = [];
      setRecordedVideo(recordedVideo);
      console.log("record ended");
      setStarted(false);
    });

    recorder.current.start();
  };

  const stopRecorder = () => {
    if (recorder.current && isStarted) recorder.current.stop();
  };

  return [
    { isReady, recordedVideo },
    { startRecorder, stopRecorder },
  ];
};

const useFaceDetector = (vdo) => {
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

const snapVideo = (video) => {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
  const dataURL = canvas.toDataURL();
  return dataURL;
};

export const ActiveLivenessEkyc = () => {
  const progressRef = useRef();
  const videoRef = useRef();
  const [{ isFaceDetected }] = useFaceDetector(videoRef.current);
  const [{ recordedVideo, isReady }, { startRecorder, stopRecorder }] =
    useRecorder(videoRef);

  const [isValid, setValid] = useState(false);
  const [isCaptureStarted, setCaptureStarted] = useState(false);
  const [isCaptureSuccess, setCaptureSuccess] = useState(false);
  const [shouldStartRecord, setShouldStartRecord] = useState(false);
  const [isLoading, setLoading] = useState(false);
  const [retries, setRetries] = useState(0);
  const [isSuccess, setSuccess] = useState(false);

  useEffect(() => {
    if (isValid)
      progressRef.current.addEventListener("animationend", () => {
        setShouldStartRecord(true);
      });
  }, [isValid]);

  useEffect(() => {
    /*
     * Face comparison effect
     * Steps:
     * - While `isFaceDetect` value is true
     * - Start face capturing with progress ring
     * - Then send that captured image to face comparison api
     */

    if (isFaceDetected) {
      setCaptureStarted(true);
      setTimeout(() => {
        const response = snapVideo(videoRef.current);
        if (response) {
          setCaptureSuccess(true);
          // TODO: implement face comparison
          faceComparisonService(response).then(() => setValid(true));
        }
      }, 1.2 * second);
    } else {
      setValid(false);
    }
  }, [isFaceDetected]);

  useEffect(() => {
    /*
     * Liveness detection effect
     * Steps:
     * - While `isFaceDetect` value is true and user has passed Face comparision
     * - Start video record with current vdo stream for 5 seconds
     * - Then send that recorded video to liveness detection api
     * - If api result return any falsy value within 3 times
     *   - redo video capturing again
     * - If retries more than 3 times show some error message
     */
    let timeout;
    if (shouldStartRecord && retries <= 3) {
      startRecorder();

      timeout = setTimeout(() => {
        stopRecorder();
        setShouldStartRecord(false);
      }, 5 * second);
    }

    return () => clearTimeout(timeout);
  }, [
    isCaptureSuccess,
    startRecorder,
    stopRecorder,
    shouldStartRecord,
    retries,
  ]);

  useEffect(() => {
    if (recordedVideo) {
      setLoading(true);
      livenessService(recordedVideo)
        .then(({ data }) => {
          if (!data.pass) {
            setRetries((prev) => prev + 1);
            setShouldStartRecord(true);
          } else {
            setSuccess(true);
          }
          setLoading(false);
        })
        .catch((err) => {
          setLoading(false);
          setRetries((prev) => prev + 1);
          setShouldStartRecord(true);
        });
    }
  }, [recordedVideo]);

  return (
    <>
      <div className="w-screen max-w-full py-10 flex justify-center">
        <div
          className={classNames(
            "relative",
            "flex",
            "justify-center",
            "items-center",
            "relative"
          )}
        >
          {(isValid || isCaptureSuccess) && (
            <Svg
              ref={progressRef}
              className={classNames("absolute", "w-full", "h-full")}
              style={{ zIndex: 1000 }}
              threshold={1.5}
              isReady={isCaptureStarted}
            >
              <circle
                cx="50%"
                cy="50%"
                r="30%"
                strokeWidth="10"
                fill="transparent"
                stroke="lightgreen"
              />
            </Svg>
          )}
          <div
            style={{
              width: "95%",
              height: "95%",
              WebkitMaskImage: "radial-gradient(circle, black 45%, rgba(0, 0, 0, 0.5) 45%)",
              maskImage:
                "radial-gradient(circle, black 40%, rgba(0, 0, 0, 0.5) 40%)",
            }}
          >
            <video
              className="w-auto h-auto min-h-full min-w-full bg-black"
              style={{
                transform: "scaleX(-1)",
              }}
              ref={videoRef}
              autoPlay
              muted
              playsInline
            />
          </div>
        </div>
      </div>
      <h1 className="text-4xl font-bold text-center">
        {!isReady && "Initializing..."}
        {isReady && !isValid && !isCaptureStarted && "Please be in frame"}
        {isCaptureStarted &&
          !isLoading &&
          !isSuccess &&
          !shouldStartRecord &&
          "Hold your camera still"}
        {shouldStartRecord &&
          retries < 3 &&
          "Please yaw and nod"}
        {!shouldStartRecord && isLoading && "Processing..."}
        {retries >= 3 && "Face comparison failed, Please redo everything again"}
        {isSuccess && "Success"}
      </h1>
    </>
  );
};

export default ActiveLivenessEkyc
