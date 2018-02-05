var mongoose = require('mongoose');

var SectionSchema = new mongoose.Schema({
  name: {
  	type: String,
    trim: true,
  	required: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    index: true,
    required: true
  }
});

SectionSchema.index({name: 'text'});

module.exports = mongoose.model('Section', SectionSchema);