var mongoose = require('mongoose');

var RegionSchema = new mongoose.Schema({
  name: {
  	type: String,
  	trim: true,
  	required: true
  }
});

RegionSchema.index({name: 'text'});

module.exports = mongoose.model('Region', RegionSchema);