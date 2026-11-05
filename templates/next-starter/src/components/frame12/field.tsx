'use client';

import * as React from 'react';

export type FieldDensity = 'comfortable' | 'compact';

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(function Label(
  { required, className = '', children, ...rest },
  ref,
) {
  return (
    <label ref={ref} className={`f12-label${className ? ` ${className}` : ''}`} {...rest}>
      {children}
      {required && (
        <span className="f12-field-req" aria-hidden="true">
          {' '}
          *
        </span>
      )}
    </label>
  );
});

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
  isRadioGroup?: boolean;
  isControlGroup?: boolean;
  registerRadioGroup?: () => void;
  registerControlGroup?: () => void;
  registerControlId?: (instanceId: string, explicitId?: string) => () => void;
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

interface SubtreeInspection {
  hasRadioGroup: boolean;
  hasLabeledCheckOrSwitch: boolean;
  controlCount: number;
  firstControlId?: string;
}

function inspectFieldSubtree(node: React.ReactNode): SubtreeInspection {
  const result: SubtreeInspection = {
    hasRadioGroup: false,
    hasLabeledCheckOrSwitch: false,
    controlCount: 0,
    firstControlId: undefined,
  };

  const walk = (n: React.ReactNode) => {
    React.Children.forEach(n, (child) => {
      if (!React.isValidElement<Record<string, unknown>>(child)) return;

      if (child.type === React.Fragment) {
        walk(child.props.children as React.ReactNode);
        return;
      }

      const fnType = child.type as {
        f12IsGroup?: boolean;
        f12IsCheckOrSwitch?: boolean;
        f12IsControl?: boolean;
      };

      const isNativeControl =
        typeof child.type === 'string' &&
        (child.type === 'input' || child.type === 'textarea' || child.type === 'select');

      const isRadioGroup = Boolean(fnType && fnType.f12IsGroup);
      const isCheckOrSwitch = Boolean(fnType && fnType.f12IsCheckOrSwitch);
      const isFrame12Control = Boolean(fnType && fnType.f12IsControl);

      if (isRadioGroup) {
        result.hasRadioGroup = true;
        result.controlCount += 1;
        if (
          !result.firstControlId &&
          typeof child.props.id === 'string' &&
          child.props.id.length > 0
        ) {
          result.firstControlId = child.props.id;
        }
        return;
      }

      if (isCheckOrSwitch || isFrame12Control || isNativeControl) {
        result.controlCount += 1;
        if (isCheckOrSwitch && Boolean(child.props.label)) {
          result.hasLabeledCheckOrSwitch = true;
        }
        if (
          !result.firstControlId &&
          typeof child.props.id === 'string' &&
          child.props.id.length > 0
        ) {
          result.firstControlId = child.props.id;
        } else if (!result.firstControlId && isFrame12Control && child.props.children) {
          const findTriggerId = (sub: React.ReactNode) => {
            React.Children.forEach(sub, (sc) => {
              if (result.firstControlId || !React.isValidElement<Record<string, unknown>>(sc)) {
                return;
              }
              const scType = sc.type as { f12IsSelectTrigger?: boolean };
              if (
                scType?.f12IsSelectTrigger &&
                typeof sc.props.id === 'string' &&
                sc.props.id.length > 0
              ) {
                result.firstControlId = sc.props.id;
                return;
              }
              if (sc.props?.children) {
                findTriggerId(sc.props.children as React.ReactNode);
              }
            });
          };
          findTriggerId(child.props.children as React.ReactNode);
        }
        return;
      }

      if (child.props && child.props.children) {
        walk(child.props.children as React.ReactNode);
      }
    });
  };

  walk(node);
  return result;
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
  const [registeredRadioGroup, setRegisteredRadioGroup] = React.useState(false);
  const [registeredControlGroup, setRegisteredControlGroup] = React.useState(false);
  const [registeredControlId, setRegisteredControlId] = React.useState<string | undefined>(
    undefined,
  );
  const registeredInstancesRef = React.useRef<Map<string, string | undefined>>(new Map());

  const registerRadioGroup = React.useCallback(() => {
    setRegisteredRadioGroup((prev) => (prev ? prev : true));
  }, []);

  const registerControlGroup = React.useCallback(() => {
    setRegisteredControlGroup((prev) => (prev ? prev : true));
  }, []);

  const registerControlId = React.useCallback(
    (instanceId: string, explicitId?: string) => {
      if (!instanceId) return () => {};
      registeredInstancesRef.current.set(instanceId, explicitId);
      if (registeredInstancesRef.current.size > 1) {
        setRegisteredControlGroup((prev) => (prev ? prev : true));
      }
      if (explicitId) {
        setRegisteredControlId((prev) => prev ?? explicitId);
      }
      return () => {
        registeredInstancesRef.current.delete(instanceId);
      };
    },
    [],
  );

  const fallbackId = `f12-field-${autoId}`;
  const prelimId = htmlFor || registeredControlId || id || fallbackId;
  const prelimLabelId = label ? `${prelimId}-label` : undefined;
  const prelimHintId = hint ? `${prelimId}-hint` : undefined;
  const prelimErrorId = error ? `${prelimId}-error` : undefined;
  const prelimDescribedBy =
    [prelimHintId, prelimErrorId].filter(Boolean).join(' ') || undefined;

  const prelimContext: FieldContextValue = {
    id: prelimId,
    label,
    labelId: prelimLabelId,
    hintId: prelimHintId,
    errorId: prelimErrorId,
    describedBy: prelimDescribedBy,
    invalid: Boolean(error),
    disabled,
    required,
    density,
    isRadioGroup: registeredRadioGroup,
    isControlGroup: registeredControlGroup,
    registerRadioGroup,
    registerControlGroup,
    registerControlId,
  };

  const initialChildren =
    typeof children === 'function' ? children(prelimContext) : children;
  const inspected = inspectFieldSubtree(initialChildren);

  const isRadioGroup = inspected.hasRadioGroup || registeredRadioGroup;
  const isControlGroup =
    !isRadioGroup &&
    (inspected.hasLabeledCheckOrSwitch ||
      inspected.controlCount > 1 ||
      registeredControlGroup);

  const controlId =
    htmlFor || inspected.firstControlId || registeredControlId || id || fallbackId;
  const wrapperId = id && id !== controlId ? id : isControlGroup && id ? id : undefined;
  const metaBaseId = id || controlId;
  const labelId = label ? `${metaBaseId}-label` : undefined;
  const hintId = hint ? `${metaBaseId}-hint` : undefined;
  const errorId = error ? `${metaBaseId}-error` : undefined;
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
      required: isControlGroup ? undefined : required,
      density,
      isRadioGroup,
      isControlGroup,
      registerRadioGroup,
      registerControlGroup,
      registerControlId,
    }),
    [
      controlId,
      label,
      labelId,
      hintId,
      errorId,
      describedBy,
      error,
      disabled,
      required,
      density,
      isRadioGroup,
      isControlGroup,
      registerRadioGroup,
      registerControlGroup,
      registerControlId,
    ],
  );

  const resolvedChildren =
    typeof children === 'function'
      ? controlId !== prelimId ||
        labelId !== prelimLabelId ||
        hintId !== prelimHintId ||
        errorId !== prelimErrorId ||
        isRadioGroup !== registeredRadioGroup ||
        isControlGroup !== registeredControlGroup
        ? children(contextValue)
        : initialChildren
      : initialChildren;

  const childElement = React.isValidElement<Record<string, unknown>>(resolvedChildren)
    ? resolvedChildren
    : null;

  let renderedChildren: React.ReactNode;
  if (
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
    const existingClass =
      typeof childProps.className === 'string' ? childProps.className : '';
    const inputType =
      childElement.type === 'input'
        ? ((childProps.type as string | undefined) ?? 'text')
        : '';
    let defaultControlClass = '';
    if (childElement.type === 'textarea') {
      defaultControlClass = `f12-textarea${isCompact ? ' f12-textarea-compact' : ''}`;
    } else if (childElement.type === 'select') {
      defaultControlClass = `f12-select-trigger${isCompact ? ' f12-input-compact' : ''}`;
    } else if (inputType === 'checkbox') {
      defaultControlClass = `f12-checkbox-input${isCompact ? ' f12-checkbox-compact' : ''}`;
    } else if (inputType === 'radio') {
      defaultControlClass = `f12-radio-input${isCompact ? ' f12-radio-compact' : ''}`;
    } else if (inputType !== 'hidden') {
      defaultControlClass = `f12-input${isCompact ? ' f12-input-compact' : ''}`;
    }
    const mergedClassName =
      [defaultControlClass, existingClass].filter(Boolean).join(' ') || undefined;

    renderedChildren = React.cloneElement(childElement, {
      id: (childProps.id as string | undefined) || controlId,
      className: mergedClassName,
      'aria-describedby': mergedDescribedBy,
      'aria-invalid':
        (childProps['aria-invalid'] as boolean | 'true' | 'false' | undefined) ??
        (error ? true : undefined),
      disabled: (childProps.disabled as boolean | undefined) ?? disabled,
      required: (childProps.required as boolean | undefined) ?? required,
    });
  } else {
    renderedChildren = resolvedChildren;
  }

  return (
    <FieldContext.Provider value={contextValue}>
      <div
        ref={ref}
        id={wrapperId}
        role={isControlGroup ? 'group' : undefined}
        aria-labelledby={isControlGroup && labelId ? labelId : undefined}
        aria-describedby={isControlGroup ? describedBy : undefined}
        className={`f12-field${isCompact ? ' f12-field-compact' : ''}${className ? ` ${className}` : ''}`}
        data-density={isCompact ? 'compact' : undefined}
        data-disabled={disabled ? '' : undefined}
        {...rest}
      >
        {label && !isRadioGroup && (
          isControlGroup ? (
            <div id={labelId} className="f12-label">
              {label}
              {required && (
                <span className="f12-field-req" aria-hidden="true">
                  {' '}
                  *
                </span>
              )}
            </div>
          ) : (
            <label id={labelId} htmlFor={controlId} className="f12-label">
              {label}
              {required && (
                <span className="f12-field-req" aria-hidden="true">
                  {' '}
                  *
                </span>
              )}
            </label>
          )
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
