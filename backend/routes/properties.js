const express = require('express');
const { body, validationResult } = require('express-validator');
const Property = require('../models/Property');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/properties - List user's properties
router.get('/', protect, async (req, res, next) => {
  try {
    const filter = req.user.role === 'owner'
      ? { owner: req.user._id }
      : { _id: { $in: req.user.properties } };

    const properties = await Property.find(filter).sort('-createdAt');
    res.json(properties);
  } catch (error) {
    next(error);
  }
});

// GET /api/properties/:id
router.get('/:id', protect, async (req, res, next) => {
  try {
    const property = await Property.findById(req.params.id).populate('bookings');
    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }
    res.json(property);
  } catch (error) {
    next(error);
  }
});

// POST /api/properties
router.post('/', protect, authorize('owner', 'manager'), [
  body('name').trim().notEmpty().withMessage('Property name is required')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const property = await Property.create({
      ...req.body,
      owner: req.user._id
    });

    // Add property to user's properties list
    req.user.properties.push(property._id);
    await req.user.save();

    res.status(201).json(property);
  } catch (error) {
    next(error);
  }
});

// PUT /api/properties/:id
router.put('/:id', protect, authorize('owner', 'manager'), async (req, res, next) => {
  try {
    const property = await Property.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }
    res.json(property);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/properties/:id
router.delete('/:id', protect, authorize('owner'), async (req, res, next) => {
  try {
    const property = await Property.findByIdAndDelete(req.params.id);
    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }
    res.json({ message: 'Property deleted' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
