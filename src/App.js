import { useEffect, useRef, useState } from "react";
import classNames from "classnames";
import styled, { css, keyframes } from "styled-components";
import Select from "react-select";
import { useFaceDetector, useRecorder } from "./hooks";
import { livenessService, faceComparisonService } from "./services";
import { snapVideo } from "./utilities";

const second = 1000;

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

const dropdownOptions = [
  { value: "blink", label: "blink" },
  { value: "mouth", label: "mouth" },
  { value: "yaw", label: "yaw" },
  { value: "nod", label: "nod" },
];

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
  const [livenessAction, setLivenessAction] = useState(dropdownOptions[0]);

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
      livenessService(recordedVideo, livenessAction.value)
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
  }, [recordedVideo, livenessAction]);

  return (
    <>
      <div className="w-screen max-w-full py-10 flex flex-col justify-center">
        <div className="flex justify-center mb-5">
          <Select
            options={dropdownOptions}
            defaultValue={dropdownOptions[0]}
            onChange={option => setLivenessAction(option)}
            styles={{
              container: () => ({
                position: "relative",
                zIndex: "5000"
              })
            }}
          />
        </div>
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
              WebkitMaskImage:
                "radial-gradient(circle, black 45%, rgba(0, 0, 0, 0.5) 45%)",
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
        {shouldStartRecord && retries < 3 && `Please ${livenessAction.label}`}
        {!shouldStartRecord && isLoading && "Processing..."}
        {retries >= 3 && "Face comparison failed, Please redo everything again"}
        {isSuccess && "Success"}
      </h1>
    </>
  );
};

export default ActiveLivenessEkyc;
