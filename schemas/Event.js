const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
    description: String,
    descriptionHighlight: String,
    day: String,
    time: Number,
    updatedTime: Number,
    createdAt: {
        type: String,
        immutable: true,
        default:  () => new Date().toLocaleString(),
    },
    madeBy:{
        type:String,
    }
})


module.exports = mongoose.model("User", userSchema)