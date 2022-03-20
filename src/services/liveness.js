const BASE_URL = "https://ml-uat.appman.co.th";
const API_KEY = "D0VJdgq51n8Gsgs6FyjiY7Ib3qMEtWJK3Fy93BoB";
const REF_NO = "EKYC20220304070952355";

export const livenessService = async (clientVdo) => {
  const body = new FormData();
  body.append("video", clientVdo);
  body.append("rotate", true);
  body.append("sequence", "yaw,nod");
  try {
    const response = await fetch(`${BASE_URL}/mw/e-kyc/fr-active-liveness`, {
      method: "POST",
      body,
      headers: {
        "x-api-key": API_KEY,
        "reference-number": REF_NO,
      },
    });
    return response.json();
  } catch (err) {
    console.log(err);
  }
  return true;
};

export default livenessService
