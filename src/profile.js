document.getElementById("copyButton").addEventListener("click", function () {
  const inputField = document.getElementById("myInput");
  const feedbackMessage = document.getElementById("feedbackMessage");

  // Use the Clipboard API
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(inputField.value)
      .then(() => {
        feedbackMessage.style.display = "block";
        setTimeout(() => {
          feedbackMessage.style.display = "none";
        }, 2000); // Hide after 2 seconds
      })
      .catch((err) => {
        console.error("Failed to copy text: ", err);
        alert("Failed to copy text.");
      });
  } else {
    // Fallback for older browsers (e.g., using document.execCommand)
    inputField.select();
    document.execCommand("copy");
    feedbackMessage.style.display = "block";
    setTimeout(() => {
      feedbackMessage.style.display = "none";
    }, 2000);
  }
});
