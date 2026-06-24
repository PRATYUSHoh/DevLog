const multer = require("multer");

//For memory storage
const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
    },

    //allowed file types
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "application/pdf",
        ];
        if (allowedTypes.includes(file.mimetype)) {
            return cb(null, true);
        } else {
            return cb(new Error("Invalid file type. Only JPEG, PNG, and PDF are allowed."), false);
        }
    }
});

module.exports = upload;