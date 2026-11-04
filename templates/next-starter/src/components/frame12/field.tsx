'use client';

import * as React from 'react';

export type FieldDensity = 'comfortable' | 'compact';

export interface FieldContextValue {
  id: string;
  label?: React.ReactNode;
  labelId?: string;
  hintId?: string;
  errorId?: string;
  describedBy?: string;
  invalid?: boolean;
  disabled?: boolean;
  required?: boolean;
  density: FieldDensity;
}

const FIELD_CTX_KEY = Symbol.for('frame12.FieldContext');
const globalFieldRegistry = globalThis as unknown as Record<
  symbol,
  React.Context<FieldContextValue | null> | undefined
>;
const FieldContext = (globalFieldRegistry[FIELD_CTX_KEY] ??=
  React.createContext<FieldContextValue | null>(null));

export function useFieldContext(): FieldContextValue | null {
  return React.useContext(FieldContext);
}

export interface FieldProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  id?: string;
  htmlFor?: string;
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  density?: FieldDensity;
  required?: boolean;
  disabled?: boolean;
  children?: React.ReactNode | ((field: FieldContextValue) => React.ReactNode);
}

export const Field = React.forwardRef<HTMLDivElement, FieldProps>(function Field(
  {
    id,
    htmlFor,
    label,
    hint,
    error,
    density = 'comfortable',
    required,
    disabled,
    className = '',
    children,
    ...rest
  },
  ref,
) {
  const autoId = React.useId().replace(/:/g, '');
  const childElement = React.isValidElement<Record<string, unknown>>(children) ? children : null;
  const childId =
    childElement && typeof childElement.props.id === 'string' && childElement.props.id.length > 0
      ? childElement.props.id
      : undefined;
  const isGroupChild = Boolean(
    childElement &&
      typeof childElement.type === 'object' &&
      childElement.type !== null &&
      (childElement.type as { f12IsGroup?: boolean }).f12IsGroup,
  );

  const controlId = htmlFor || id || childId || `f12-field-${autoId}`;
  const labelId = label ? `${controlId}-label` : undefined;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  const isCompact = density === 'compact';

  const contextValue = React.useMemo<FieldContextValue>(
    () => ({
      id: controlId,
      label,
      labelId,
      hintId,
      errorId,
      describedBy,
      invalid: Boolean(error),
      disabled,
      required,
      density,
    }),
    [controlId, label, labelId, hintId, errorId, describedBy, error, disabled, required, density],
  );

  let renderedChildren: React.ReactNode;
  if (typeof children === 'function') {
    renderedChildren = children(contextValue);
  } else if (
    childElement &&
    typeof childElement.type === 'string' &&
    (childElement.type === 'input' ||
      childElement.type === 'textarea' ||
      childElement.type === 'select')
  ) {
    const childProps = childElement.props;
    const mergedDescribedBy =
      [childProps['aria-describedby'] as string | undefined, describedBy]
        .filter(Boolean)
        .join(' ') || undefined;
    renderedChildren = React.cloneElement(childElement, {
      id: (childProps.id as string | undefined) ?? controlId,
      'aria-describedby': mergedDescribedBy,
      'aria-invalid':
        (childProps['aria-invalid'] as boolean | 'true' | 'false' | undefined) ??
        (error ? true : undefined),
      disabled: (childProps.disabled as boolean | undefined) ?? disabled,
      required: (childProps.required as boolean | undefined) ?? required,
    });
  } else {
    renderedChildren = children;
  }

  return (
    <FieldContext.Provider value={contextValue}>
      <div
        ref={ref}
        className={`f12-field${isCompact ? ' f12-field-compact' : ''}${className ? ` ${className}` : ''}`}
        data-density={isCompact ? 'compact' : undefined}
        data-disabled={disabled ? '' : undefined}
        {...rest}
      >
        {label && !isGroupChild && (
          <label id={labelId} htmlFor={controlId} className="f12-label">
            {label}
            {required && (
              <span className="f12-field-req" aria-hidden="true">
                {' '}
                *
              </span>
            )}
          </label>
        )}
        {renderedChildren}
        {hint && (
          <p id={hintId} className="f12-hint">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} className="f12-error" role="alert">
            <span className="f12-error-flag" aria-hidden="true">
              !
            </span>
            <span>{error}</span>
          </p>
        )}
      </div>
    </FieldContext.Provider>
  );
});
