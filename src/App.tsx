import React, { useState } from 'react';
import { CollageWorkspace } from './components/workspaces/CollageWorkspace';
import { PolaroidWorkspace } from './components/workspaces/PolaroidWorkspace';
import { JerseyWorkspace } from './components/workspaces/JerseyWorkspace';
import { BabyWorkspace } from './components/workspaces/BabyWorkspace';
import { type TemplateType } from './utils/TemplateGenerators';

function App() {
  console.log("App mounting");
  const [template, setTemplate] = useState<TemplateType>('collage');

  const handleSwitchTemplate = (newTemplate: TemplateType) => {
    setTemplate(newTemplate);
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-100">
      {template === 'collage' && (
        <CollageWorkspace onSwitchTemplate={handleSwitchTemplate} />
      )}

      {template === 'polaroid' && (
        <PolaroidWorkspace onSwitchTemplate={handleSwitchTemplate} />
      )}

      {template === 'jersey' && (
        <JerseyWorkspace onSwitchTemplate={handleSwitchTemplate} />
      )}

      {template === 'baby' && (
        <BabyWorkspace onSwitchTemplate={handleSwitchTemplate} />
      )}
    </div>
  );
}

export default App;