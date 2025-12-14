import { useState } from 'react';
import { CollageWorkspace } from './components/workspaces/CollageWorkspace';
import { PolaroidWorkspace } from './components/workspaces/PolaroidWorkspace';
import { PapaWorkspace } from './components/workspaces/PapaWorkspace';
import { JerseyWorkspace } from './components/workspaces/JerseyWorkspace';
import { BabyWorkspace } from './components/workspaces/BabyWorkspace';
import { ConstructorWorkspace } from './components/workspaces/ConstructorWorkspace';
import { type TemplateType } from './utils/TemplateGenerators';
import { MockupEnvironment } from './components/MockupEnvironment';

function App() {
  console.log("App mounting");
  const [template, setTemplate] = useState<TemplateType>('collage');
  const [showMockup, setShowMockup] = useState(false);

  const handleSwitchTemplate = (newTemplate: TemplateType) => {
    setTemplate(newTemplate);
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-100 relative">
      <div className="font-preload">
        Caveat Preload Text To Ensure Font Metrics Are Ready
      </div>

      {/* --- MOCKUP ENVIRONMENT (OVERLAY) --- */}
      {showMockup && <MockupEnvironment onClose={() => setShowMockup(false)} />}

      {template === 'collage' && (
        <CollageWorkspace
          onSwitchTemplate={handleSwitchTemplate}
          onOpenMockup={() => setShowMockup(true)}
        />
      )}

      {template === 'polaroid' && (
        <PolaroidWorkspace
          onSwitchTemplate={handleSwitchTemplate}
          onOpenMockup={() => setShowMockup(true)}
        />
      )}

      {template === 'papa' && (
        <PapaWorkspace onSwitchTemplate={handleSwitchTemplate} />
      )}

      {template === 'jersey' && (
        <JerseyWorkspace onSwitchTemplate={handleSwitchTemplate} />
      )}

      {template === 'baby' && (
        <BabyWorkspace onSwitchTemplate={handleSwitchTemplate} />
      )}

      {template === 'constructor' && (
        <ConstructorWorkspace onSwitchTemplate={handleSwitchTemplate} />
      )}
    </div>
  );
}

export default App;