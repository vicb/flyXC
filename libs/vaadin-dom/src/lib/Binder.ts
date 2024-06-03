import type { AbstractModel, BinderConfiguration, ModelConstructor } from '@vaadin/nodom';
import { NoDomBinder, _onChange } from '@vaadin/nodom';
import type { FieldStrategy } from './Field';
import { getDefaultFieldStrategy } from './Field';

export class Binder<T, M extends AbstractModel<T>> extends NoDomBinder<T, M> {
  /**
   *
   * @param context The form view component instance to update.
   * @param Model The constructor (the class reference) of the form model. The Binder instantiates the top-level model
   * @param config The options object, which can be used to config the onChange and onSubmit callbacks.
   *
   * ```
   * binder = new Binder(orderView, OrderModel);
   * or
   * binder = new Binder(orderView, OrderModel, {onSubmit: async (order) => {endpoint.save(order)}});
   * ```
   */
  constructor(public override context: Element, Model: ModelConstructor<T, M>, config?: BinderConfiguration<T>) {
    super(Model, config);

    this.context = context;

    if (!this[_onChange] && typeof (context as any).requestUpdate === 'function') {
      this[_onChange] = () => (context as any).requestUpdate();
    }
  }

  /**
   * Determines and returns the field directive strategy for the bound element.
   * Override to customise the binding strategy for a component.
   * The Binder extends BinderNode, see the inherited properties and methods below.
   *
   * @param elm the bound element
   */
  getFieldStrategy(elm: any): FieldStrategy {
    return getDefaultFieldStrategy(elm);
  }
}
