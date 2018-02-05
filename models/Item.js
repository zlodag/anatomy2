var mongoose = require('mongoose');

var ItemSchema = new mongoose.Schema({
  name: {
  	type: String,
    trim: true,
  	required: true
  },
  category: {
    type: Number,
    min: 1,
    max: 3,
    required: true,
    validate : {
      validator : Number.isInteger,
      message   : '{VALUE} is not an integer value'
    }
  },
  section: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Section',
    index: true,
    required: true
  },
  introduction: String,
  structure: String,
  superiorRelations: [String],
  inferiorRelations: [String],
  anteriorRelations: [String],
  posteriorRelations: [String],
  medialRelations: [String],
  lateralRelations: [String],
  superiorBoundary: String,
  inferiorBoundary: String,
  anteriorBoundary: String,
  posteriorBoundary: String,
  medialBoundary: String,
  lateralBoundary: String,
  contents: [String],
  articulations: [String],
  attachments: [String],
  specialStructures: [String],
  nerveSupply: String,
  arterialSupply: String,
  venousDrainage: String,
  lymphaticDrainage: String,
  variants: [String]
});

ItemSchema.index({name: 'text'});

module.exports = mongoose.model('Item', ItemSchema);