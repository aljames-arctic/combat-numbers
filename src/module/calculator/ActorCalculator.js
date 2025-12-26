import AbstractCalculator from './AbstractCalculator';

/**
 * Used for any Actor-specific HP calculations.
 */
export default class ActorCalculator extends AbstractCalculator {
  _getOrigEntityHpPath() {
    return `system.${this.hpObjectPathFinder.getHpPath()}`;
  }

  _getOrigEntityHpTempPath() {
    return `system.${this.hpObjectPathFinder.getHpTempPath()}`;
  }

  _getChangedEntityHpPath() {
    return `system.${this.hpObjectPathFinder.getHpPath()}`;
  }

  _getChangedEntityHpTempPath() {
    return `system.${this.hpObjectPathFinder.getHpTempPath()}`;
  }
}
