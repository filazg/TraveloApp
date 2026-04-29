const path = require("path");

const handleDocumentationFeature = async (req, res) => {
    try {
        const filePath = path.join(__dirname, "..", "..", "downloadDoc", "documentation.pdf");
        return res.sendFile(filePath);
    } catch (error) {
        console.log("documentationFeature error:", error?.message || error);
        return res.status(500).json({ msg: "Internal error" });
    }
};

module.exports = { handleDocumentationFeature };
