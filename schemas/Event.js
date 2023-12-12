const mongoose = require('mongoose')

const eventSchema = new mongoose.Schema({
    description: String,
    descriptionHighlight: String,
    day: String,
    time: String,
    oldTime: String,
    link:String,
    linkText:String,
    createdAt: {
        type: String,
        immutable: true,
        default:  () => new Date().toLocaleString(),
    },
    madeBy:{
        type:String,
    }
})

module.exports = mongoose.model("Event", eventSchema)