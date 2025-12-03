import React, { useState } from 'react';
import { CollageWorkspace } from './components/workspaces/CollageWorkspace';
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
        <div className="flex h-full items-center justify-center bg-zinc-50">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-zinc-300 mb-4">Polaroid Mode</h2>
            <button
              onClick={() => setTemplate('collage')}
              className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm"
            >
              Back to Collage
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;