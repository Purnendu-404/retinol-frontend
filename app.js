const BACKEND_URL = "https://retinol-backend.onrender.com";
const ML_URL = "https://retinol-ml.onrender.com";

// --------------------------------------------------
// THEME
// --------------------------------------------------

const THEME_STORAGE_KEY = "retinol-theme";
const themeToggle = document.getElementById("themeToggle");

function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    themeToggle.setAttribute("aria-pressed", String(theme === "dark"));
    themeToggle.setAttribute(
        "aria-label",
        theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
    );
}

function getPreferredTheme() {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

applyTheme(getPreferredTheme());

themeToggle.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    applyTheme(next);
    localStorage.setItem(THEME_STORAGE_KEY, next);
});

// Follow the system theme until the user picks one explicitly.
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (event) => {
    if (localStorage.getItem(THEME_STORAGE_KEY)) return;
    applyTheme(event.matches ? "dark" : "light");
});

// --------------------------------------------------
// CLINICAL REFERENCE DATA
// --------------------------------------------------

const GRADE_INFO = {
    0: {
        severity: "No DR",
        triageLabel: "Normal",
        triageLevel: "normal",
        advisory:
            "No signs of diabetic retinopathy detected. Vascular pattern and macula appear within normal limits. Routine annual screening is recommended."
    },
    1: {
        severity: "Mild NPDR",
        triageLabel: "Monitor",
        triageLevel: "monitor",
        advisory:
            "Early microaneurysms may be present. No urgent action is required — recommend re-screening within 12 months."
    },
    2: {
        severity: "Moderate NPDR",
        triageLabel: "Monitor",
        triageLevel: "monitor",
        advisory:
            "Increased microvascular changes observed. Recommend closer monitoring and re-screening within 6–12 months."
    },
    3: {
        severity: "Severe NPDR",
        triageLabel: "Refer",
        triageLevel: "refer",
        advisory:
            "Significant microvascular changes observed. Referral to an ophthalmologist is recommended within 3 months."
    },
    4: {
        severity: "Proliferative DR",
        triageLabel: "Urgent referral",
        triageLevel: "urgent",
        advisory:
            "Neovascular changes may be present. Urgent referral to an ophthalmologist is recommended as soon as possible."
    }
};

const LOW_CONFIDENCE_THRESHOLD = 0.5;


// --------------------------------------------------
// DOM ELEMENTS
// --------------------------------------------------

const patientId = document.getElementById("patientId");
const patientName = document.getElementById("patientName");
const patientAge = document.getElementById("patientAge");
const patientGender = document.getElementById("patientGender");
const patientContact = document.getElementById("patientContact");

const imageInput = document.getElementById("imageInput");
const browseButton = document.getElementById("browseButton");
const dropZone = document.getElementById("dropZone");
const uploadPlaceholder = document.getElementById("uploadPlaceholder");
const previewContainer = document.getElementById("previewContainer");
const imagePreview = document.getElementById("imagePreview");
const removeImage = document.getElementById("removeImage");

const analyzeButton = document.getElementById("analyzeButton");

const resultSection = document.getElementById("resultSection");
const prediction = document.getElementById("prediction");
const severityLabel = document.getElementById("severityLabel");
const confidence = document.getElementById("confidence");
const triageStatus = document.getElementById("triageStatus");
const advisoryText = document.getElementById("advisoryText");
const probabilityBody = document.getElementById("probabilityBody");

const resultOriginalImage = document.getElementById("resultOriginalImage");
const processedImage = document.getElementById("processedImage");
const edgeImage = document.getElementById("edgeImage");

const statusMessage = document.getElementById("statusMessage");


// --------------------------------------------------
// STATE
// --------------------------------------------------

let selectedFile = null;
let selectedFileObjectUrl = null;
let resultOriginalObjectUrl = null;
let isAnalyzing = false;


// --------------------------------------------------
// STATUS
// --------------------------------------------------

function showStatus(message, type = "normal") {
    statusMessage.textContent = message;
    statusMessage.classList.remove("hidden", "success", "error", "normal");
    statusMessage.classList.add(type);
}

function hideStatus() {
    statusMessage.textContent = "";
    statusMessage.classList.add("hidden");
}


// --------------------------------------------------
// PATIENT
// --------------------------------------------------

function getPatientData() {
    return {
        patient_id: patientId.value.trim(),
        name: patientName.value.trim(),
        age: Number(patientAge.value),
        gender: patientGender.value,
        contact: patientContact.value.trim()
    };
}

function validatePatient() {
    const data = getPatientData();

    if (!data.patient_id) throw new Error("Please enter the Patient ID.");
    if (!data.name) throw new Error("Please enter the patient's name.");
    if (!data.age || data.age < 1 || data.age > 120) throw new Error("Please enter a valid patient age.");
    if (!data.gender) throw new Error("Please select the patient's gender.");
    if (!data.contact) throw new Error("Please enter the patient's contact number.");

    return data;
}

function validateImage() {
    if (!selectedFile) throw new Error("Please select a retinal fundus image.");
    if (!selectedFile.type.startsWith("image/")) throw new Error("Please select a valid image file.");
}


// --------------------------------------------------
// IMAGE PREVIEW
// --------------------------------------------------

function showImagePreview(file) {
    selectedFile = file;

    if (selectedFileObjectUrl) URL.revokeObjectURL(selectedFileObjectUrl);

    selectedFileObjectUrl = URL.createObjectURL(file);
    imagePreview.src = selectedFileObjectUrl;

    uploadPlaceholder.classList.add("hidden");
    previewContainer.classList.remove("hidden");
}

function clearImage() {
    selectedFile = null;

    if (selectedFileObjectUrl) {
        URL.revokeObjectURL(selectedFileObjectUrl);
        selectedFileObjectUrl = null;
    }

    imageInput.value = "";
    imagePreview.src = "";

    previewContainer.classList.add("hidden");
    uploadPlaceholder.classList.remove("hidden");

    clearResult();
}


// --------------------------------------------------
// FILE SELECTION
// --------------------------------------------------

browseButton.addEventListener("click", (event) => {
    event.stopPropagation();
    imageInput.click();
});

dropZone.addEventListener("click", () => {
    if (previewContainer.classList.contains("hidden")) imageInput.click();
});

dropZone.addEventListener("keydown", (event) => {
    if ((event.key === "Enter" || event.key === " ") && previewContainer.classList.contains("hidden")) {
        event.preventDefault();
        imageInput.click();
    }
});

imageInput.addEventListener("change", () => {
    const file = imageInput.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
        showStatus("Please select a valid image file.", "error");
        imageInput.value = "";
        return;
    }

    hideStatus();
    clearResult();
    showImagePreview(file);
});

removeImage.addEventListener("click", (event) => {
    event.stopPropagation();
    clearImage();
});


// --------------------------------------------------
// DRAG & DROP
// --------------------------------------------------

dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropZone.classList.add("dragging");
});

dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragging");
});

dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropZone.classList.remove("dragging");

    const file = event.dataTransfer.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
        showStatus("Please drop a valid image file.", "error");
        return;
    }

    hideStatus();
    clearResult();
    showImagePreview(file);

    try {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        imageInput.files = dataTransfer.files;
    } catch (error) {
        console.warn("Could not synchronize dropped file with input.", error);
    }
});


// --------------------------------------------------
// BACKEND REQUEST HELPER
// --------------------------------------------------

async function fetchJSON(url, options = {}) {
    const response = await fetch(url, options);

    let data = null;
    try {
        data = await response.json();
    } catch (error) {
        // Response was not JSON.
    }

    if (!response.ok) {
        const message = data?.message || data?.error || `Request failed with status ${response.status}`;
        throw new Error(message);
    }

    return data;
}

let backendReady = false;
let mlReady = false;

async function wakeBackend() {
    while (!backendReady) {
        try {
            console.log("Waking backend...");

            const response = await fetch(`${BACKEND_URL}/health`);

            if (response.ok) {
                backendReady = true;
                console.log("Backend is ready.");
                return;
            }

            console.log(`Backend returned ${response.status}`);
        } catch (error) {
            console.log("Backend is still waking...");
        }

        await new Promise(resolve => setTimeout(resolve, 5000));
    }
}


async function wakeML() {
    while (!mlReady) {
        try {
            console.log("Waking ML service...");

            const response = await fetch(`${ML_URL}/health`);

            let data = null;

            try {
                data = await response.json();
            } catch (error) {
                // Ignore non-JSON response.
            }

            if (response.ok && data?.status === "ready") {
                mlReady = true;
                console.log("ML service is ready.");
                return;
            }

            console.log("ML service/model is still loading...");
        } catch (error) {
            console.log("ML service is still waking...");
        }

        await new Promise(resolve => setTimeout(resolve, 5000));
    }
}


// --------------------------------------------------
// CLOUDINARY
// --------------------------------------------------

async function getCloudinarySignature() {
    return await fetchJSON(`${BACKEND_URL}/api/cloudinary/signature`);
}

async function uploadToCloudinary(file, uploadConfig) {
    const { api_key, timestamp, signature, cloud_name, folder } = uploadConfig;

    if (!api_key || !timestamp || !signature || !cloud_name) {
        throw new Error("Invalid Cloudinary upload configuration received from backend.");
    }

    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("api_key", api_key);
    formData.append("timestamp", timestamp);
    formData.append("signature", signature);
    if (folder) formData.append("folder", folder);

    const response = await fetch(uploadUrl, { method: "POST", body: formData });

    let data = null;
    try {
        data = await response.json();
    } catch (error) {
        // Cloudinary response was not JSON.
    }

    if (!response.ok) {
        const message = data?.error?.message || data?.message || `Cloudinary upload failed with status ${response.status}`;
        throw new Error(message);
    }

    if (!data?.secure_url) throw new Error("Cloudinary upload succeeded but no secure_url was returned.");

    return data.secure_url;
}


// --------------------------------------------------
// PATIENT API
// --------------------------------------------------

async function checkPatient(patientIdValue) {
    const response = await fetch(`${BACKEND_URL}/api/patients/${encodeURIComponent(patientIdValue)}`);

    let data = null;
    try {
        data = await response.json();
    } catch (error) {
        // Response may not contain JSON.
    }

    if (response.ok) return { exists: true, data };
    if (response.status === 404) return { exists: false, data: null };

    const message = data?.message || data?.error || `Unable to check patient. Status: ${response.status}`;
    throw new Error(message);
}

async function createPatient(patientData) {
    return await fetchJSON(`${BACKEND_URL}/api/patients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patientData)
    });
}


// --------------------------------------------------
// SCREENING API
// --------------------------------------------------

async function createScreening(patientIdValue, imageUrl) {
    return await fetchJSON(`${BACKEND_URL}/api/screenings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patient_id: patientIdValue, image_url: imageUrl })
    });
}


// --------------------------------------------------
// RESULT IMAGES
// --------------------------------------------------

function displayResultImages(result) {
    // The original file is already in the browser — no need to round-trip it through the backend.
    if (resultOriginalObjectUrl) {
        URL.revokeObjectURL(resultOriginalObjectUrl);
        resultOriginalObjectUrl = null;
    }

    if (selectedFile) {
        resultOriginalObjectUrl = URL.createObjectURL(selectedFile);
        resultOriginalImage.src = resultOriginalObjectUrl;
    }

    if (result.processed_image) {
        processedImage.src = `data:image/png;base64,${result.processed_image}`;
    } else {
        processedImage.removeAttribute("src");
    }

    if (result.edge_image) {
        edgeImage.src = `data:image/png;base64,${result.edge_image}`;
    } else {
        edgeImage.removeAttribute("src");
    }
}


// --------------------------------------------------
// GRADE PARSING & TRIAGE
// --------------------------------------------------

function parseGradeNumber(predictionValue) {
    const match = String(predictionValue).match(/\d+/);
    return match ? Number(match[0]) : null;
}

function applyVerdict(predictionValue, confidenceValue) {
    prediction.textContent = predictionValue;

    const gradeNumber = parseGradeNumber(predictionValue);
    const info = GRADE_INFO[gradeNumber];

    severityLabel.textContent = info ? info.severity : "Unclassified";

    triageStatus.textContent = info ? info.triageLabel : "Review";
    triageStatus.dataset.level = info ? info.triageLevel : "monitor";

    let advisory = info
        ? info.advisory
        : "Grade could not be matched to a known severity band. Manual review is recommended.";

    if (confidenceValue < LOW_CONFIDENCE_THRESHOLD) {
        advisory += " Model confidence for this reading is low — clinical correlation is advised.";
    }

    advisoryText.textContent = advisory;
}


// --------------------------------------------------
// RESULT UI
// --------------------------------------------------

function displayResult(result) {
    if (!result) throw new Error("No screening result received.");

    const predictionValue = result.prediction;
    const confidenceValue = Number(result.confidence);
    const probabilities = result.probabilities;

    if (predictionValue === undefined || predictionValue === null) {
        throw new Error("Screening response does not contain a prediction.");
    }

    if (!Number.isFinite(confidenceValue)) {
        throw new Error("Screening response contains an invalid confidence.");
    }

    if (!probabilities || typeof probabilities !== "object") {
        throw new Error("Screening response does not contain probabilities.");
    }

    // Verdict card (grade, severity, triage, advisory)
    applyVerdict(predictionValue, confidenceValue);

    // Confidence
    confidence.textContent = `${(confidenceValue * 100).toFixed(1)}%`;

    // Pipeline images
    displayResultImages(result);

    // Probability table
    probabilityBody.innerHTML = "";

    for (let grade = 0; grade <= 4; grade++) {
        const label = `Grade ${grade}`;
        const rawProbability = Number(probabilities[label]);
        const probability = Number.isFinite(rawProbability) ? rawProbability : 0;
        const percentage = Math.max(0, Math.min(100, probability * 100));
        const info = GRADE_INFO[grade];

        const row = document.createElement("tr");

        const gradeCell = document.createElement("td");
        gradeCell.className = "prob-grade";
        gradeCell.textContent = label;

        const severityCell = document.createElement("td");
        severityCell.className = "prob-severity";
        severityCell.textContent = info ? info.severity : "—";

        const valueCell = document.createElement("td");

        const valueWrap = document.createElement("div");
        valueWrap.className = "prob-value-cell";

        const track = document.createElement("div");
        track.className = "prob-bar-track";

        const fill = document.createElement("div");
        fill.className = "prob-bar-fill";
        fill.style.width = `${percentage}%`;

        const valueLabel = document.createElement("span");
        valueLabel.textContent = `${percentage.toFixed(1)}%`;

        track.appendChild(fill);
        valueWrap.appendChild(track);
        valueWrap.appendChild(valueLabel);
        valueCell.appendChild(valueWrap);

        row.appendChild(gradeCell);
        row.appendChild(severityCell);
        row.appendChild(valueCell);

        probabilityBody.appendChild(row);
    }

    // Reveal result
    resultSection.classList.remove("hidden");
    document.querySelector('.stepper-item[data-step="result"]').classList.add("is-active");

    resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
}


// --------------------------------------------------
// CLEAR RESULT
// --------------------------------------------------

function clearResult() {
    prediction.textContent = "—";
    severityLabel.textContent = "—";
    confidence.textContent = "—";
    triageStatus.textContent = "—";
    triageStatus.removeAttribute("data-level");
    advisoryText.textContent = "—";
    probabilityBody.innerHTML = "";

    resultOriginalImage.removeAttribute("src");
    if (resultOriginalObjectUrl) {
        URL.revokeObjectURL(resultOriginalObjectUrl);
        resultOriginalObjectUrl = null;
    }

    processedImage.removeAttribute("src");
    edgeImage.removeAttribute("src");

    resultSection.classList.add("hidden");
    document.querySelector('.stepper-item[data-step="result"]').classList.remove("is-active");
}


// --------------------------------------------------
// MAIN ANALYSIS FLOW
// --------------------------------------------------

async function analyzeImage() {
    if (isAnalyzing) return;

    try {
        const patientData = validatePatient();
        validateImage();

        clearResult();

        isAnalyzing = true;
        analyzeButton.disabled = true;
        analyzeButton.classList.add("is-loading");

        showStatus("Preparing upload...", "normal");
        const cloudinaryConfig = await getCloudinarySignature();

        showStatus("Uploading image...", "normal");
        const imageUrl = await uploadToCloudinary(selectedFile, cloudinaryConfig);

        if (!imageUrl) throw new Error("Image upload did not return a secure URL.");

        showStatus("Checking patient record...", "normal");
        const patientResult = await checkPatient(patientData.patient_id);

        if (!patientResult.exists) {
            await createPatient(patientData);
        }

        showStatus("Running retinal analysis...", "normal");
        const screeningResponse = await createScreening(patientData.patient_id, imageUrl);

        const screeningData = screeningResponse?.data;
        if (!screeningData) throw new Error("Backend did not return screening data.");

        displayResult(screeningData);

        showStatus("Analysis complete.", "success");
    } catch (error) {
        console.error("Analysis error:", error);
        showStatus(error.message || "Something went wrong while analyzing the image.", "error");
    } finally {
        isAnalyzing = false;
        analyzeButton.disabled = false;
        analyzeButton.classList.remove("is-loading");
    }
}

analyzeButton.addEventListener("click", analyzeImage);

// Wake backend and ML service in parallel.
Promise.all([
    wakeBackend(),
    wakeML()
]).catch(error => {
    console.error("Service wake-up error:", error);
});