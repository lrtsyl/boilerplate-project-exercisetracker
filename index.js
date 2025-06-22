require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// ----- MONGOOSE SETUP -----
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// ----- MIDDLEWARE -----
app.use(cors());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ----- ROUTES -----
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

// --- Models ---
const userSchema = new mongoose.Schema({
  username: { type: String, required: true }
});
const User = mongoose.model('User', userSchema);

const exerciseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  description: { type: String, required: true },
  duration: { type: Number, required: true },
  date: { type: Date, default: Date.now }
});
const Exercise = mongoose.model('Exercise', exerciseSchema);

// --- Create User ---
app.post('/api/users', async (req, res, next) => {
  try {
    const user = new User({ username: req.body.username });
    const saved = await user.save();
    res.json({ username: saved.username, _id: saved._id });
  } catch (err) {
    next(err);
  }
});

// --- List All Users ---
app.get('/api/users', async (req, res, next) => {
  try {
    const users = await User.find().select('username _id');
    res.json(users);
  } catch (err) {
    next(err);
  }
});

// --- Add Exercise ---
app.post('/api/users/:_id/exercises', async (req, res, next) => {
  try {
    const { description, duration, date } = req.body;

    // If date is an empty string or invalid, default to today
    let d = date ? new Date(date) : new Date();
    if (isNaN(d)) d = new Date();

    const ex = new Exercise({
      userId: req.params._id,
      description,
      duration: parseInt(duration),
      date: d
    });
    const savedEx = await ex.save();
    const user = await User.findById(req.params._id);

    res.json({
      _id: user._id,
      username: user.username,
      date: savedEx.date.toDateString(),
      duration: savedEx.duration,
      description: savedEx.description
    });
  } catch (err) {
    next(err);
  }
});

// --- Get Exercise Log ---
app.get('/api/users/:_id/logs', async (req, res, next) => {
  try {
    const { from, to, limit } = req.query;

    // Build a filter object
    const filter = { userId: req.params._id };
    if (from || to) filter.date = {};
    if (from) {
      const f = new Date(from);
      if (!isNaN(f)) filter.date.$gte = f;
    }
    if (to) {
      const t = new Date(to);
      if (!isNaN(t)) filter.date.$lte = t;
    }

    let query = Exercise.find(filter).select('description duration date');
    if (limit) query = query.limit(parseInt(limit));

    const exercises = await query.exec();

    const log = exercises.map(e => ({
      description: e.description,
      duration: e.duration,
      date: e.date.toDateString()
    }));

    const user = await User.findById(req.params._id).select('username');
    res.json({
      _id: user._id,
      username: user.username,
      count: log.length,
      log
    });
  } catch (err) {
    next(err);
  }
});

// --- ERROR HANDLING ---
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

// --- START SERVER ---
const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port);
});