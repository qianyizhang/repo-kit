import { hosted, interactionDiagnostics } from './host';
import { standaloneInspection } from './api';
import { Icon } from './Icon';

export function ConnectionInfo() {
  return (
    <button
      className="icon-button"
      aria-label="App info"
      title="App info"
      onClick={() => (hosted ? interactionDiagnostics : standaloneInspection).show()}
    >
      <Icon name="info" />
    </button>
  );
}
