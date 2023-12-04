const mongoose = require('mongoose')

const strikesShema = new mongoose.Schema({
    name: String,
    reasoning: String,
    strikeNr: Number,
    createdAt: {
        type: String,
        immutable: true,
        default:  () => new Date().toLocaleString(),
    },
    madeBy: String
})

module.exports = mongoose.model("Strikes", strikesShema)