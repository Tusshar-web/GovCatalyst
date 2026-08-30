const Joi = require('joi');

const challengeStatusEnum = ['draft', 'published', 'screening', 'evaluation', 'pilot', 'validation', 'scale_up', 'closed', 'rejected'];
const riskLevelEnum = ['low', 'medium', 'high'];

const validators = {
  challengeCreate: Joi.object({
    title: Joi.string().required(),
    raw_problem_input: Joi.string().required(),
    sector: Joi.string().optional().allow(null, ''),
    tech_tags: Joi.array().items(Joi.string()).optional(),
    budget_ceiling: Joi.number().optional().allow(null),
    pilot_duration_days: Joi.number().optional().allow(null),
    risk_level: Joi.string().valid(...riskLevelEnum).optional(),
    min_turnover_required: Joi.number().optional().allow(null),
    min_experience_years: Joi.number().optional().allow(null)
  }).unknown(true),

  challengeUpdate: Joi.object({
    status: Joi.string().valid(...challengeStatusEnum).optional(),
    title: Joi.string().optional(),
    outcome_statement: Joi.string().optional(),
    sector: Joi.string().optional().allow(null, ''),
    tech_tags: Joi.array().items(Joi.string()).optional(),
    budget_ceiling: Joi.number().optional().allow(null),
    pilot_duration_days: Joi.number().optional().allow(null),
    risk_level: Joi.string().valid(...riskLevelEnum).optional(),
    min_turnover_required: Joi.number().optional().allow(null),
    min_experience_years: Joi.number().optional().allow(null)
  }).unknown(true),

  evaluationScoreSubmit: Joi.object({
    assignmentId: Joi.string().required(),
    scores: Joi.array().items(
      Joi.object({
        criterionId: Joi.string().required(),
        score: Joi.number().min(0).max(10).required(),
        comments: Joi.string().optional().allow(null, ''),
        justification: Joi.string().optional().allow(null, '')
      })
    ).required()
  }).unknown(true)
};

function validateRequest(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        details: error.details.map(d => d.message)
      });
    }
    req.body = value; // Assign the sanitized/converted value back
    next();
  };
}

module.exports = {
  validators,
  validateRequest
};
