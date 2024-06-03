// TODO: Fix dependency cycle

import type { BinderNode } from './BinderNode';
import type { AbstractModel} from './Models';
import { getBinderNode, NumberModel } from './Models';
import type { NoDomBinder } from './NoDomBinder';
import { Required } from './Validators';

export interface ValueError<T> {
  property: string | AbstractModel<any>;
  message: string;
  value: T;
  validator: Validator<T>;
}

export interface ValidationResult {
  property: string | AbstractModel<any>;
  message?: string;
}

export class ValidationError extends Error {
  public constructor(public errors: ReadonlyArray<ValueError<any>>) {
    super(
      [
        'There are validation errors in the form.',
        ...errors.map((e) => `${e.property} - ${e.validator.constructor.name}${e.message ? `: ${e.message}` : ''}`),
      ].join('\n - '),
    );
    this.name = this.constructor.name;
  }
}

export type ValidationCallback<T> = (
  value: T,
  binder: NoDomBinder<any, AbstractModel<T>>,
) =>
  | boolean
  | ValidationResult
  | ReadonlyArray<ValidationResult>
  | Promise<boolean | ValidationResult | ReadonlyArray<ValidationResult>>;

export type InterpolateMessageCallback<T> = (
  message: string,
  validator: Validator<T>,
  binderNode: BinderNode<T, AbstractModel<T>>,
) => string;

export interface Validator<T> {
  validate: ValidationCallback<T>;
  message: string;
  impliesRequired?: boolean;
}

export class ServerValidator implements Validator<any> {
  public message: string;

  public constructor(message: string) {
    this.message = message;
  }

  public validate = () => false;
}

export async function runValidator<T>(
  model: AbstractModel<T>,
  validator: Validator<T>,
  interpolateMessageCallback?: InterpolateMessageCallback<T>,
): Promise<ReadonlyArray<ValueError<T>>> {
  const binderNode = getBinderNode(model);
  const { value } = binderNode;

  const interpolateMessage = (message: string) => {
    if (!interpolateMessageCallback) {
      return message;
    }
    return interpolateMessageCallback(message, validator, binderNode);
  };

  // If model is not required and value empty, do not run any validator. Except
  // always validate NumberModel, which has a mandatory builtin validator
  // to indicate NaN input.
  if (!getBinderNode(model).required && !new Required().validate(value!) && !(model instanceof NumberModel)) {
    return [];
  }
  return (async () => validator.validate(value!, getBinderNode(model).binder))().then((result) => {
    if (result === false) {
      return [
        { property: getBinderNode(model).name, value, validator, message: interpolateMessage(validator.message) },
      ];
    }
    if (result === true || (Array.isArray(result) && result.length === 0)) {
      return [];
    } else if (Array.isArray(result)) {
      return result.map((result2: ValidationResult) => ({
        message: interpolateMessage(validator.message),
        ...(absolutePropertyPath(model, result2) as any),
        value,
        validator,
      }));
    } else {
      return [
        {
          message: interpolateMessage(validator.message),
          ...absolutePropertyPath(model, result as any as ValidationResult),
          value,
          validator,
        },
      ];
    }
  });
}

// Transforms the "property" field of the result to an absolute path.
// Note: this is a fix for vaadin.
function absolutePropertyPath<T>(model: AbstractModel<T>, result: ValidationResult): ValidationResult {
  if (typeof result.property === 'string') {
    const path = getBinderNode(model).name;
    if (path.length > 0) {
      result.property = getBinderNode(model).name + '.' + result.property;
    }
  }
  return result;
}
