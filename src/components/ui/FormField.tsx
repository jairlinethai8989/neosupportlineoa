'use client';

import React, { useId } from 'react';
import { clsx } from 'clsx';
import styles from './ui.module.css';

interface BaseFieldProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  labelRight?: React.ReactNode;
  wrapperClassName?: string;
}

function useFieldAria(idProp?: string, hasHint?: boolean, hasError?: boolean) {
  const autoId = useId();
  const id = idProp || autoId;
  const hintId = hasHint ? `${id}-hint` : undefined;
  const errorId = hasError ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;
  return { id, hintId, errorId, describedBy };
}

interface FieldChromeProps {
  id: string;
  label?: string;
  required?: boolean;
  labelRight?: React.ReactNode;
  hint?: string;
  hintId?: string;
  error?: string;
  errorId?: string;
  wrapperClassName?: string;
  children: React.ReactNode;
}

function FieldChrome({
  id,
  label,
  required,
  labelRight,
  hint,
  hintId,
  error,
  errorId,
  wrapperClassName,
  children,
}: FieldChromeProps) {
  return (
    <div className={clsx(styles.field, wrapperClassName)}>
      {(label || labelRight) && (
        <div className={styles.fieldLabelRow}>
          {label ? (
            <label htmlFor={id} className={styles.fieldLabel}>
              {label}
              {required ? (
                <span className={styles.fieldRequired} aria-hidden="true">
                  *
                </span>
              ) : null}
            </label>
          ) : (
            <span />
          )}
          {labelRight}
        </div>
      )}
      {children}
      {error ? (
        <p id={errorId} className={styles.fieldError} role="alert">
          {error}
        </p>
      ) : null}
      {hint ? (
        <p id={hintId} className={styles.fieldHint}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export interface InputProps extends BaseFieldProps, React.InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: React.ReactNode;
  rightAdornment?: React.ReactNode;
}

/**
 * Accessible text input with built-in <label htmlFor>, hint, error, and aria-invalid.
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    id: idProp,
    label,
    hint,
    error,
    required,
    labelRight,
    wrapperClassName,
    leftIcon,
    rightAdornment,
    className,
    'aria-describedby': ariaDescribedBy,
    ...rest
  },
  ref
) {
  const { id, hintId, errorId, describedBy } = useFieldAria(idProp, Boolean(hint), Boolean(error));
  const mergedDescribedBy = [ariaDescribedBy, describedBy].filter(Boolean).join(' ') || undefined;

  return (
    <FieldChrome
      id={id}
      label={label}
      required={required}
      labelRight={labelRight}
      hint={hint}
      hintId={hintId}
      error={error}
      errorId={errorId}
      wrapperClassName={wrapperClassName}
    >
      <div className={styles.fieldControlWrap}>
        {leftIcon ? <span className={styles.fieldIconLeft}>{leftIcon}</span> : null}
        <input
          ref={ref}
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={mergedDescribedBy}
          className={clsx(
            styles.fieldControl,
            Boolean(leftIcon) && styles.fieldControlWithLeft,
            Boolean(rightAdornment) && styles.fieldControlWithRight,
            Boolean(error) && styles.fieldControlInvalid,
            className
          )}
          {...rest}
        />
        {rightAdornment ? <span className={styles.fieldAdornmentRight}>{rightAdornment}</span> : null}
      </div>
    </FieldChrome>
  );
});

export interface SelectProps extends BaseFieldProps, React.SelectHTMLAttributes<HTMLSelectElement> {}

/**
 * Accessible select control with built-in <label htmlFor>, hint, error, and aria-invalid.
 */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    id: idProp,
    label,
    hint,
    error,
    required,
    labelRight,
    wrapperClassName,
    className,
    children,
    'aria-describedby': ariaDescribedBy,
    ...rest
  },
  ref
) {
  const { id, hintId, errorId, describedBy } = useFieldAria(idProp, Boolean(hint), Boolean(error));
  const mergedDescribedBy = [ariaDescribedBy, describedBy].filter(Boolean).join(' ') || undefined;

  return (
    <FieldChrome
      id={id}
      label={label}
      required={required}
      labelRight={labelRight}
      hint={hint}
      hintId={hintId}
      error={error}
      errorId={errorId}
      wrapperClassName={wrapperClassName}
    >
      <select
        ref={ref}
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={mergedDescribedBy}
        className={clsx(
          styles.fieldControl,
          styles.fieldSelect,
          Boolean(error) && styles.fieldControlInvalid,
          className
        )}
        {...rest}
      >
        {children}
      </select>
    </FieldChrome>
  );
});

export interface TextareaProps extends BaseFieldProps, React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

/**
 * Accessible multiline textarea with built-in <label htmlFor>, hint, error, and aria-invalid.
 */
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    id: idProp,
    label,
    hint,
    error,
    required,
    labelRight,
    wrapperClassName,
    className,
    'aria-describedby': ariaDescribedBy,
    ...rest
  },
  ref
) {
  const { id, hintId, errorId, describedBy } = useFieldAria(idProp, Boolean(hint), Boolean(error));
  const mergedDescribedBy = [ariaDescribedBy, describedBy].filter(Boolean).join(' ') || undefined;

  return (
    <FieldChrome
      id={id}
      label={label}
      required={required}
      labelRight={labelRight}
      hint={hint}
      hintId={hintId}
      error={error}
      errorId={errorId}
      wrapperClassName={wrapperClassName}
    >
      <textarea
        ref={ref}
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={mergedDescribedBy}
        className={clsx(
          styles.fieldControl,
          styles.fieldTextarea,
          Boolean(error) && styles.fieldControlInvalid,
          className
        )}
        {...rest}
      />
    </FieldChrome>
  );
});
