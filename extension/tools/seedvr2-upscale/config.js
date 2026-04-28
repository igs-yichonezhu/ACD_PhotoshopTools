/* ============================================================
 *  SeedVR2 放大修正 - API 設定檔
 *  ============================================================
 *  ⚠️ 此檔案只有「管理者」要改。
 *  美術同仁不需要、也不應該動這裡。
 *
 *  之後換 API（不論換 RunningHub 帳號、換工作流，
 *  甚至換成別家服務），都只要改下面幾行：
 * ============================================================ */

window.SEEDVR2_CONFIG = {

    // 【1】RunningHub 後台取得的 API Key
    API_KEY: "36c43c9967d4470f90f7ef7cb77b94d1",

    // 【2】RunningHub 上傳工作流後得到的 workflowId
    WORKFLOW_ID: "2048574941422948353",

    // 【3】RunningHub OpenAPI 網址（.cn 或 .ai，依帳號註冊地）
    BASE_URL: "https://www.runninghub.cn",

    // 【4】工作流節點 ID（對應 SeedVR2-放大修正_api.json）
    INPUT_NODE_ID:   "106",   // LoadImage
    CONTROL_NODE_ID: "78",   // SeedVR2VideoUpscaler
    OUTPUT_NODE_ID:  "108",   // PreviewImage

    // 【5】預設目標長邊（px）
    DEFAULT_TARGET_SIZE: 2160,

    // 【6】輪詢設定
    POLL_INTERVAL_MS:  2000,    // 每次查詢間隔
    POLL_MAX_ATTEMPTS: 600,     // 最多次數（2s × 600 ≒ 20 分鐘）

    // 【7】上傳檔案大小上限（RunningHub 規定 10MB）
    MAX_UPLOAD_BYTES: 10 * 1024 * 1024
};
