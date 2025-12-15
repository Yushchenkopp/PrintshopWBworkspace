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
  const [mockupCount, setMockupCount] = useState(0);
  const [initialPrintData, setInitialPrintData] = useState<string | null>(null);

  const handleTransferToMockup = (printData: string) => {
    setInitialPrintData(printData);
    setShowMockup(true);
  };

  const handleSwitchTemplate = (newTemplate: TemplateType) => {
    setTemplate(newTemplate);
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-100 relative">
      <div className="font-preload">
        Caveat Preload Text To Ensure Font Metrics Are Ready
      </div>

      {/* --- MOCKUP ENVIRONMENT (OVERLAY) --- */}
      {/* --- MOCKUP ENVIRONMENT (PERSISTENT) --- */}
      <MockupEnvironment
        isOpen={showMockup}
        onClose={() => setShowMockup(false)}
        onPrintCountChange={setMockupCount}
        initialFrontPrint={initialPrintData}
      />

      {template === 'collage' && (
        <CollageWorkspace
          onSwitchTemplate={handleSwitchTemplate}
          onOpenMockup={() => setShowMockup(true)}
          mockupPrintCount={mockupCount}
        />
      )}

      {template === 'polaroid' && (
        <PolaroidWorkspace
          onSwitchTemplate={handleSwitchTemplate}
          onOpenMockup={() => setShowMockup(true)}
          mockupPrintCount={mockupCount}
        />
      )}

      {template === 'papa' && (
        <PapaWorkspace
          onSwitchTemplate={handleSwitchTemplate}
          onOpenMockup={() => setShowMockup(true)}
          onTransferToMockup={handleTransferToMockup}
          mockupPrintCount={mockupCount}
        />
      )}

      {template === 'jersey' && (
        <JerseyWorkspace
          onSwitchTemplate={handleSwitchTemplate}
          onOpenMockup={() => setShowMockup(true)}
          mockupPrintCount={mockupCount}
        />
      )}

      {template === 'baby' && (
        <BabyWorkspace
          onSwitchTemplate={handleSwitchTemplate}
          onOpenMockup={() => setShowMockup(true)}
          mockupPrintCount={mockupCount}
        />
      )}

      {template === 'constructor' && (
        <ConstructorWorkspace
          onSwitchTemplate={handleSwitchTemplate}
          onOpenMockup={() => setShowMockup(true)}
          mockupPrintCount={mockupCount}
        />
      )}
    </div>
  );
}

export default App;