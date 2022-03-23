import { useEffect, useRef, useState } from "react";

const initialMediaDevice = async () => {
  return navigator.mediaDevices.getUserMedia({ video: true, audio: false });
};

const getSupportedRecorderMimeType = () => {
  const mp4 = MediaRecorder.isTypeSupported("video/mp4");
  const webm = MediaRecorder.isTypeSupported("video/webm");

  if (webm) return "video/webm";

  if (mp4) return "video/mp4";
};

export const useRecorder = (videoRef) => {
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
      setRecordedVideo(
        new File([recordedVideo], `${new Date()}.mp4`, {
          type: getSupportedRecorderMimeType(),
        })
      );
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

export default useRecorder;
