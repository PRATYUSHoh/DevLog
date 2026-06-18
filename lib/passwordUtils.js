const bcrypt = require('bcrypt');

async function validPassword(password, hash) {
    // bcrypt.compare handles salt automatically
    // no need to pass salt separately anymore!
    return await bcrypt.compare(password, hash);
}

async function genPassword(password) {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    // no need to return salt separately!
    // bcrypt stores it inside the hash itself
    return { hash };
}

module.exports.validPassword = validPassword;
module.exports.genPassword = genPassword;