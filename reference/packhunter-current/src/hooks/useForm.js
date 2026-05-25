/**
 * useForm - Comprehensive form handling hook
 *
 * Features:
 * - Field-level validation on blur
 * - Form-level validation on submit
 * - Error state management
 * - Touched state tracking
 * - Reset functionality
 * - getFieldProps helper for MUI integration
 */

import { useState, useCallback, useMemo } from 'react'

export function useForm({
  initialValues = {},
  validate,
  onSubmit,
  validateOnChange = false,
  validateOnBlur = true,
}) {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitCount, setSubmitCount] = useState(0)

  // Validate single field
  const validateField = useCallback((field, value) => {
    if (!validate) return undefined

    const allErrors = validate({ ...values, [field]: value })
    return allErrors[field]
  }, [validate, values])

  // Validate all fields
  const validateAll = useCallback(() => {
    if (!validate) return {}
    return validate(values)
  }, [validate, values])

  // Handle field change
  const handleChange = useCallback((field) => (event) => {
    const value = event?.target?.value ?? event

    setValues(prev => ({ ...prev, [field]: value }))

    // Clear error when field changes
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }

    // Validate on change if enabled
    if (validateOnChange && validate) {
      const fieldError = validateField(field, value)
      if (fieldError) {
        setErrors(prev => ({ ...prev, [field]: fieldError }))
      }
    }
  }, [errors, validateOnChange, validate, validateField])

  // Handle field blur
  const handleBlur = useCallback((field) => () => {
    setTouched(prev => ({ ...prev, [field]: true }))

    // Validate on blur if enabled
    if (validateOnBlur && validate) {
      const fieldError = validateField(field, values[field])
      if (fieldError) {
        setErrors(prev => ({ ...prev, [field]: fieldError }))
      }
    }
  }, [validateOnBlur, validate, validateField, values])

  // Handle form submission
  const handleSubmit = useCallback(async (event) => {
    event?.preventDefault()
    setSubmitCount(prev => prev + 1)

    // Mark all fields as touched
    const allTouched = Object.keys(values).reduce((acc, key) => ({ ...acc, [key]: true }), {})
    setTouched(allTouched)

    // Validate all fields
    if (validate) {
      const validationErrors = validate(values)
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors)
        return { success: false, errors: validationErrors }
      }
    }

    setIsSubmitting(true)
    try {
      const result = await onSubmit(values)
      return { success: true, result }
    } catch (error) {
      return { success: false, error }
    } finally {
      setIsSubmitting(false)
    }
  }, [values, validate, onSubmit])

  // Reset form to initial values
  const reset = useCallback((newValues) => {
    setValues(newValues || initialValues)
    setErrors({})
    setTouched({})
    setSubmitCount(0)
  }, [initialValues])

  // Set a single field value
  const setFieldValue = useCallback((field, value) => {
    setValues(prev => ({ ...prev, [field]: value }))
  }, [])

  // Set a single field error
  const setFieldError = useCallback((field, error) => {
    setErrors(prev => ({ ...prev, [field]: error }))
  }, [])

  // Set a single field touched
  const setFieldTouched = useCallback((field, isTouched = true) => {
    setTouched(prev => ({ ...prev, [field]: isTouched }))
  }, [])

  // Get props for a form field (MUI TextField compatible)
  const getFieldProps = useCallback((field) => ({
    name: field,
    value: values[field] ?? '',
    onChange: handleChange(field),
    onBlur: handleBlur(field),
    error: touched[field] && !!errors[field],
    helperText: touched[field] && errors[field],
  }), [values, errors, touched, handleChange, handleBlur])

  // Get props for checkbox/switch fields
  const getCheckboxProps = useCallback((field) => ({
    name: field,
    checked: !!values[field],
    onChange: (event) => {
      const value = event.target.checked
      setValues(prev => ({ ...prev, [field]: value }))
    },
  }), [values])

  // Get props for select fields
  const getSelectProps = useCallback((field) => ({
    name: field,
    value: values[field] ?? '',
    onChange: (event) => {
      const value = event.target.value
      setValues(prev => ({ ...prev, [field]: value }))
      if (errors[field]) {
        setErrors(prev => ({ ...prev, [field]: undefined }))
      }
    },
    onBlur: handleBlur(field),
    error: touched[field] && !!errors[field],
  }), [values, errors, touched, handleBlur])

  // Check if form is valid
  const isValid = useMemo(() => {
    if (!validate) return true
    const validationErrors = validate(values)
    return Object.keys(validationErrors).length === 0
  }, [validate, values])

  // Check if form is dirty (values changed from initial)
  const isDirty = useMemo(() => {
    return JSON.stringify(values) !== JSON.stringify(initialValues)
  }, [values, initialValues])

  return {
    // State
    values,
    errors,
    touched,
    isSubmitting,
    isValid,
    isDirty,
    submitCount,

    // Handlers
    handleChange,
    handleBlur,
    handleSubmit,
    reset,

    // Setters
    setValues,
    setFieldValue,
    setFieldError,
    setFieldTouched,
    setErrors,

    // Field props helpers
    getFieldProps,
    getCheckboxProps,
    getSelectProps,
  }
}

// Common validation helpers
export const validators = {
  required: (value, message = 'This field is required') => {
    if (!value || (typeof value === 'string' && !value.trim())) {
      return message
    }
    return undefined
  },

  minLength: (min, message) => (value) => {
    if (value && value.length < min) {
      return message || `Must be at least ${min} characters`
    }
    return undefined
  },

  maxLength: (max, message) => (value) => {
    if (value && value.length > max) {
      return message || `Must be no more than ${max} characters`
    }
    return undefined
  },

  email: (value, message = 'Invalid email address') => {
    if (value && !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value)) {
      return message
    }
    return undefined
  },

  pattern: (regex, message = 'Invalid format') => (value) => {
    if (value && !regex.test(value)) {
      return message
    }
    return undefined
  },

  numeric: (value, message = 'Must be a number') => {
    if (value && isNaN(Number(value))) {
      return message
    }
    return undefined
  },

  min: (min, message) => (value) => {
    if (value !== '' && Number(value) < min) {
      return message || `Must be at least ${min}`
    }
    return undefined
  },

  max: (max, message) => (value) => {
    if (value !== '' && Number(value) > max) {
      return message || `Must be no more than ${max}`
    }
    return undefined
  },

  // Compose multiple validators
  compose: (...validators) => (value) => {
    for (const validator of validators) {
      const error = validator(value)
      if (error) return error
    }
    return undefined
  },
}

// Create validation function from field config
export function createValidator(fieldValidators) {
  return (values) => {
    const errors = {}

    for (const [field, validate] of Object.entries(fieldValidators)) {
      const error = typeof validate === 'function'
        ? validate(values[field], values)
        : undefined

      if (error) {
        errors[field] = error
      }
    }

    return errors
  }
}

export default useForm
