const form = document.getElementById("uploadForm");
const fileInput = document.getElementById("pdfFile");
const loading = document.getElementById("loading");
const results = document.getElementById("results");
const tableBody = document.querySelector("#eventsTable tbody");
const downloadBtn = document.getElementById("downloadBtn");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const file = fileInput.files[0];
  if (!file) return alert("Please upload a PDF!");

  loading.classList.remove("hidden");
  results.classList.add("hidden");

// Send file to Python backend
const formData = new FormData();
formData.append("file", fileInput.files[0]); // assuming fileInput is your <input type="file">

fetch("http://127.0.0.1:5000/upload", {
  method: "POST",
  body: formData
})
  .then(response => response.json())
  .then(data => {
    loading.classList.add("hidden");
    results.classList.remove("hidden");
    displayResults(data); // uses your real backend output
  })
  .catch(error => {
    console.error("Error:", error);
    alert("Error processing file!");
    loading.classList.add("hidden");
  });

});

function displayResults(events) {
  tableBody.innerHTML = "";
  events.forEach(e => {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${e.event}</td><td>${e.date}</td>`;
    tableBody.appendChild(row);
  });
}

downloadBtn.addEventListener("click", () => {
  alert("This will download your .ics file in the real version!");
});
