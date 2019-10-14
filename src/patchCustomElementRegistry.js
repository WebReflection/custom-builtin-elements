import {
  elementsRegistry,
  nativeConstructorRegistry,
  patchedPrototypesRegistry,
} from './shared';
import {
  connect,
  defineProperties,
  getPrototypeChain,
  recognizeElementByIsAttribute,
  runForDescendants,
  setPrototypeOf,
  setup,
} from './utils';

const CERExceptionCommonText =
  "Failed to execute 'define' on 'CustomElementRegistry'";

const dashPattern = /-/;

function patchCustomElementRegistry() {
  const {define, get, upgrade, whenDefined} = customElements;

  defineProperties(customElements, {
    define: {
      configurable: true,
      value(name, constructor, options) {
        if (!options || !options.extends) {
          define.apply(customElements, arguments);

          return;
        }

        if (elementsRegistry.has(name)) {
          throw new Error(
            `${CERExceptionCommonText}: the name "${name}" has already been used with this registry`,
          );
        }

        if (elementsRegistry.has(constructor)) {
          throw new Error(
            `${CERExceptionCommonText}: this constructor has already been used with this registry`,
          );
        }

        if (!dashPattern.test(name)) {
          throw new Error(
            `${CERExceptionCommonText}: "${name}" is not a valid custom element name`,
          );
        }

        const chain = getPrototypeChain(constructor.prototype);
        const polyfilledPrototype = chain[chain.length - 1];
        const firstChild = chain[chain.length - 2];

        const nativeConstructor = nativeConstructorRegistry.get(
          polyfilledPrototype.constructor,
        );

        if (!patchedPrototypesRegistry.has(firstChild)) {
          setPrototypeOf(firstChild, nativeConstructor.prototype);
          patchedPrototypesRegistry.set(firstChild, 0);
        }

        elementsRegistry.set(name, constructor);

        const pattern = new RegExp(options.extends, 'i');

        runForDescendants(
          document.body,
          node =>
            pattern.test(node.tagName) && node.getAttribute('is') === name,
          node => {
            setup(node);
            connect(node);
          },
          true,
        );
      },
    },
    get: {
      configurable: true,
      value(name) {
        return elementsRegistry.get(name) || get.call(customElements, name);
      },
    },
    upgrade: {
      configurable: true,
      value(element) {
        const constructor = recognizeElementByIsAttribute(element);

        if (constructor) {
          setup(element, constructor);
        } else {
          upgrade.call(customElements, element);
        }
      },
    },
    whenDefined: {
      configurable: true,
      value(name) {
        return Promise.race([
          whenDefined.call(customElements, name),
          elementsRegistry.whenDefined(name),
        ]);
      },
    },
  });
}

export default patchCustomElementRegistry;
