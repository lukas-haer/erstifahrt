const mongoose = require('mongoose')

const scoreChangesSchema = new mongoose.Schema({
    houseAffected: String,
    pointsAwarded: Number,
    reasoning: String,
    createdAt: {
        type: String,
        immutable: true,
        default:  () => new Date().toLocaleString(),
    },
    madeBy:{
        type:String,
        immutable: true,
        required: true
    }
})

module.exports = mongoose.model("ScoreChanges", scoreChangesSchema)