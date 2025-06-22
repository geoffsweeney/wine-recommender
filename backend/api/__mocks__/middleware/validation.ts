export const validateRequest = () => (req: any, res: any, next: any) => {
  // Pure pass-through mock - always call next() unless we're simulating an error
  if (req.body?.simulateValidationError) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: req.body.simulateValidationError
    });
  }
  
  if (req.body?.simulateServiceError) {
    return next(new Error('Service failure'));
  }
  
  next();
};