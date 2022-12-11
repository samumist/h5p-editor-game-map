import '@styles/h5peditor-game-map.scss';
import Dictionary from '@services/dictionary';
import Globals from '@services/globals';
import Util from '@services/util';
import NoImage from '@components/no-image';
import MapEditor from '@components/map-editor/map-editor';

/** Class for Boilerplate H5P widget */
export default class GameMap {

  /**
   * @class
   * @param {object} parent Parent element in semantics.
   * @param {object} field Semantics field properties.
   * @param {object} params Parameters entered in editor form.
   * @param {function} setValue Callback to set parameters.
   */
  constructor(parent, field, params, setValue) {
    this.parent = parent;
    this.field = field;
    this.params = Util.extend({
      stages: []
    }, params);
    this.setValue = setValue;

    this.fillDictionary();

    Globals.set('mainInstance', this);

    // Callbacks to call when parameters change
    this.changes = [];

    // Let parent handle ready callbacks of children
    this.passReadies = true;

    // DOM
    this.dom = this.buildDOM();
    this.$container = H5P.jQuery(this.dom);

    // No image source info
    this.noImage = new NoImage({}, {
      onClick: () => {
        this.parent.$tabs[0].click();
      }
    });
    this.dom.appendChild(this.noImage.getDOM());

    const stagesGroup = this.field.fields
      .find((field) => field.name === 'stages').field;
    const stageFields = H5P.cloneObject(stagesGroup.fields, true);
    Globals.set('stagesGroupField', new H5PEditor.widgets[stagesGroup.type](
      this, stagesGroup, this.params.stages, () => {} // No setValue needed
    ));

    // Map canvas
    this.mapEditor = new MapEditor(
      {
        stages: this.params.stages,
        stageFields: stageFields
      },
      {
        onChanged: (stages) => {
          this.setMapValues(stages);
        }
      }
    );
    this.dom.appendChild(this.mapEditor.getDOM());

    window.addEventListener('resize', () => {
      this.mapEditor.resize();
    });

    this.parent.ready(() => {
      this.handleParentReady();
    });
  }

  /**
   * Ready handler.
   *
   * @param {function} ready Ready callback.
   */
  ready(ready) {
    if (!this.passReadies) {
      return;
    }

    this.parent.ready(ready);
  }

  /**
   * Handle parent ready.
   */
  handleParentReady() {
    this.passReadies = false;

    this.initializeColors();

    this.backgroundImageField = H5PEditor.findField(
      'backgroundImageSettings/backgroundImage', this.parent
    );

    if (!this.backgroundImageField) {
      throw H5PEditor.t(
        'core', 'unknownFieldPath', { ':path': this.backgroundImageField }
      );
    }

    this.mapEditor.setMapImage(
      H5P.getPath(this.backgroundImageField?.params?.path ?? '', H5PEditor.contentId)
    );

    this.backgroundImageField.changes.push((change) => {
      if (change) {
        this.mapEditor.setMapImage(
          H5P.getPath(change.path, H5PEditor.contentId)
        );

        return;
      }

      this.reset();
    });
  }

  /**
   * Set active (called by H5P.Wizard when changing tabs).
   */
  setActive() {
    if (!!this.backgroundImageField?.params) {
      this.noImage.hide();
      this.mapEditor.show();
    }
    else {
      this.mapEditor.hide();
      this.noImage.show();
    }
  }

  /**
   * Set map values.
   *
   * @param {object[]} stages Element parameters of stages.
   */
  setMapValues(stages) {
    this.params.stages = stages;
    this.setValue(this.field, this.params);
  }

  /**
   * Build DOM.
   *
   * @returns {HTMLElement} DOM for this class.
   */
  buildDOM() {
    const dom = document.createElement('div');
    dom.classList.add('h5peditor-game-map');

    return dom;
  }

  /**
   * Append field to wrapper. Invoked by H5P core.
   *
   * @param {H5P.jQuery} $wrapper Wrapper.
   */
  appendTo($wrapper) {
    this.$container.appendTo($wrapper);
  }

  /**
   * Validate current values. Invoked by H5P core.
   *
   * @returns {boolean} True, if current value is valid, else false.
   */
  validate() {
    return true; // TODO
  }

  /**
   * Remove self. Invoked by H5P core.
   */
  remove() {
    this.$container.remove();
  }

  /**
   * Reset.
   */
  reset() {
    this.mapEditor.reset();
  }

  /**
   * Fill Dictionary.
   */
  fillDictionary() {
    // Convert H5PEditor language strings into object.
    const plainTranslations =
      H5PEditor.language['H5PEditor.GameMap'].libraryStrings || {};
    const translations = {};

    for (const key in plainTranslations) {
      let current = translations;
      // Assume string keys separated by . or / for defining path
      const splits = key.split(/[./]+/);
      const lastSplit = splits.pop();

      // Create nested object structure if necessary
      splits.forEach((split) => {
        if (!current[split]) {
          current[split] = {};
        }
        current = current[split];
      });

      // Add translation string
      current[lastSplit] = plainTranslations[key];
    }

    Dictionary.fill(translations);
  }

  /**
   * Initialize colors.
   */
  initializeColors() {
    const style = document.createElement('style');

    if (style.styleSheet) {
      style.styleSheet.cssText = '.h5peditor-game-map{}';
    }
    else {
      style.appendChild(document.createTextNode('.h5peditor-game-map{}'));
    }
    document.head.appendChild(style);

    this.addVisualsChangeListeners(Util.getRootField(this));
  }

  /**
   * Update custom CSS property.
   *
   * @param {string} key Key.
   * @param {string} value Value.
   */
  updateCSSProperty(key, value) {
    this.dom.style.setProperty(`--editor-fields${key}`, value);
    this.mapEditor.updateEdges();
  }

  /**
   * Add change listeners for Color selectors.
   * Updates custom CSS property values.
   *
   * @param {object} field H5P editor field.
   * @param {string} path Path and name for variable
   */
  addVisualsChangeListeners(field, path = '') {
    if (!field) {
      return;
    }

    if (field instanceof H5PEditor.ColorSelector) {
      field.changes.push(() => {
        this.updateCSSProperty(path.replace(/\//g, '-'), field.params);
      });

      this.updateCSSProperty(path.replace(/\//g, '-'), field.params);
    }
    else if (
      field instanceof H5PEditor.Select) {
      if (
        field.field.name === 'pathStyle' ||
        field.field.name === 'pathWidth'
      ) {
        field.changes.push(() => {
          this.updateCSSProperty(path.replace(/\//g, '-'), field.value);
        });

        this.updateCSSProperty(path.replace(/\//g, '-'), field.value);
      }
    }
    else if (field.children) {
      (field.children || []).forEach((child) => {
        this.addVisualsChangeListeners(
          child, `${path}/${child.field.name}`
        );
      });
    }
    else if (field instanceof H5PEditor.List) {
      field.forEachChild((listItem) => {
        this.addVisualsChangeListeners(
          listItem, `${path}/${listItem.field.name}`
        );
      });
    }
    else {
      // Field is not interesting
    }
  }
}
