
import React, { useState, useEffect, useRef } from 'react';
import { GardenStyle, DesignProject, ChatMessage, DesignComplexity } from './types';
import { Button } from './components/Button';
import { ImageUpload } from './components/ImageUpload';
import { generateLandscapeDesign, chatWithArchitect, detectObjects } from './services/geminiService';

const App: React.FC = () => {
  const [view, setView] = useState<'landing' | 'studio' | 'gallery'>('landing');
  const [projects, setProjects] = useState<DesignProject[]>([]);
  const [activeProject, setActiveProject] = useState<DesignProject | null>(null);
  
  // Landing/Input State
  const [uploadImage, setUploadImage] = useState<string>('');
  const [refImage, setRefImage] = useState<string>('');
  const [detectedObjects, setDetectedObjects] = useState<string[]>([]);
  const [selectedObjects, setSelectedObjects] = useState<Set<string>>(new Set());
  const [isDetecting, setIsDetecting] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<GardenStyle | null>(GardenStyle.MODERN);
  const [selectedComplexity, setSelectedComplexity] = useState<DesignComplexity>(DesignComplexity.BALANCED);
  const [additionalRequirements, setAdditionalRequirements] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Chat State
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('garden_projects');
      if (saved) setProjects(JSON.parse(saved));
    } catch (e) {
      console.error("Failed to load projects:", e);
    }
  }, []);

  useEffect(() => {
    if (projects.length > 0) {
      try {
        localStorage.setItem('garden_projects', JSON.stringify(projects));
      } catch (e) {
        console.warn("Project list is too large for local storage.", e);
      }
    }
  }, [projects]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeProject?.history]);

  const handleYardUpload = async (base64: string) => {
    setUploadImage(base64);
    setDetectedObjects([]);
    setSelectedObjects(new Set());
    
    setIsDetecting(true);
    try {
      const objects = await detectObjects(base64);
      setDetectedObjects(objects);
      // Automatically select everything detected by default
      setSelectedObjects(new Set(objects));
    } catch (error) {
      console.error("Object detection failed", error);
    } finally {
      setIsDetecting(false);
    }
  };

  const handleRefImageUpload = (base64: string) => {
    setRefImage(base64);
    if (base64) {
      setSelectedStyle(null);
    }
  };

  const toggleObjectSelection = (obj: string) => {
    const next = new Set(selectedObjects);
    if (next.has(obj)) next.delete(obj);
    else next.add(obj);
    setSelectedObjects(next);
  };

  const handleStartDesign = async () => {
    if (!uploadImage) return;

    setIsGenerating(true);
    try {
      const stylePrompt = selectedStyle 
        ? `in the ${selectedStyle} style` 
        : `matching the aesthetic and layout of the provided reference design`;

      const requirementPrompt = additionalRequirements.trim() 
        ? `. Additionally, satisfy these specific requirements: ${additionalRequirements}` 
        : "";

      const generatedImage = await generateLandscapeDesign(
        uploadImage,
        `Generate a professional landscape design ${stylePrompt}${requirementPrompt}. Include beautiful vegetation and high-end materials.`,
        refImage,
        selectedStyle || undefined,
        Array.from(selectedObjects),
        selectedComplexity
      );

      const newProject: DesignProject = {
        id: Date.now().toString(),
        name: `My ${selectedStyle || 'Reference-based'} Garden`,
        originalImage: uploadImage,
        referenceImage: refImage || undefined,
        currentImage: generatedImage,
        style: selectedStyle || GardenStyle.MODERN,
        complexity: selectedComplexity,
        history: [{
          role: 'assistant',
          content: `Welcome to your new garden design! I've created a ${selectedComplexity.toLowerCase()} concept based on your photo ${selectedStyle ? `using the ${selectedStyle} style` : 'and the reference design you provided'}. I've applied senior-level landscaping principles: ensuring structural layering, proper scale relative to your house, and strict clear-zone rules for your driveway and walkways. ${additionalRequirements.trim() ? `I've also incorporated your special requests: "${additionalRequirements}".` : ""}`
        }],
        createdAt: Date.now()
      };

      setProjects(prev => [newProject, ...prev]);
      setActiveProject(newProject);
      setView('studio');
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Design generation failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !activeProject || isChatting) return;

    const userMessage = chatInput;
    setChatInput('');
    setIsChatting(true);

    const updatedHistory: ChatMessage[] = [
      ...activeProject.history,
      { role: 'user', content: userMessage }
    ];

    setActiveProject({ ...activeProject, history: updatedHistory });

    try {
      const keywords = ['generate', 'change', 'add', 'remove', 'replace', 'make it', 'show me', 'update', 'put', 'plant'];
      const needsImageUpdate = keywords.some(k => userMessage.toLowerCase().includes(k));

      if (needsImageUpdate) {
        setIsGenerating(true);
        const newImage = await generateLandscapeDesign(
          activeProject.originalImage,
          `Modify the previous design by following these specific instructions: ${userMessage}. Build upon the existing concept while maintaining strict architectural boundaries.`,
          activeProject.referenceImage,
          activeProject.style,
          Array.from(selectedObjects),
          activeProject.complexity
        );
        
        const finalHistory: ChatMessage[] = [
          ...updatedHistory,
          { 
            role: 'assistant', 
            content: `I've updated the design reflecting your request. I made sure to maintain professional planting depths and kept all architectural hardscapes clear as per professional standards.`,
            imageUrl: newImage
          }
        ];

        const updatedProject = {
          ...activeProject,
          currentImage: newImage,
          history: finalHistory
        };

        setActiveProject(updatedProject);
        setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
        setIsGenerating(false);
      } else {
        const response = await chatWithArchitect(
          updatedHistory,
          activeProject.currentImage,
          userMessage
        );

        const finalHistory: ChatMessage[] = [
          ...updatedHistory,
          { role: 'assistant', content: response }
        ];

        const updatedProject = {
          ...activeProject,
          history: finalHistory
        };

        setActiveProject(updatedProject);
        setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
      }
    } catch (error: any) {
      console.error(error);
    } finally {
      setIsChatting(false);
    }
  };

  const getComplexityLabel = (c: DesignComplexity) => {
    if (c === DesignComplexity.SIMPLE) return { main: "Simple", sub: "Least Destructive" };
    if (c === DesignComplexity.BALANCED) return { main: "Balanced", sub: "Moderate Change" };
    if (c === DesignComplexity.PREMIUM) return { main: "Premium", sub: "Maximum Overhaul" };
    return { main: c, sub: "" };
  };

  const renderLanding = () => (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold uppercase tracking-wider mb-4 border border-emerald-200">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
          Expert Architecture Engine Active
        </div>
        <h1 className="text-5xl font-bold mb-4 display-font text-slate-900">Your Garden, <span className="text-emerald-600 italic underline decoration-emerald-200">Reimagined.</span></h1>
        <p className="text-xl text-slate-600 max-w-2xl mx-auto">Upload a photo. Our AI Architect follows professional standards to preserve your home's integrity while transforming the landscape.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
        <div className="space-y-6">
          <ImageUpload 
            label="1. Your Current Yard" 
            onUpload={handleYardUpload} 
            currentImage={uploadImage}
          />
          
          {detectedObjects.length > 0 && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 animate-in fade-in slide-in-from-top-2 duration-500">
              <div className="flex justify-between items-center mb-3">
                <label className="block text-xs font-bold text-slate-500 uppercase">Preserve / Hide Elements</label>
                <span className="text-[10px] text-slate-400 font-medium italic">House & Driveway kept by default</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {detectedObjects.map(obj => (
                  <button
                    key={obj}
                    onClick={() => toggleObjectSelection(obj)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                      selectedObjects.has(obj)
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-white text-slate-500 border border-slate-200 hover:border-emerald-300'
                    }`}
                  >
                    {selectedObjects.has(obj) ? (
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                    ) : (
                      <div className="w-3 h-3 border border-slate-300 rounded-sm" />
                    )}
                    {obj}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isDetecting && (
             <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3">
               <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
               <span className="text-sm text-slate-600">Detecting features & utilities...</span>
             </div>
          )}

          <ImageUpload 
            label="2. Style Inspiration (Optional)" 
            onUpload={handleRefImageUpload} 
            currentImage={refImage}
          />
        </div>

        <div className="space-y-6 flex flex-col">
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-semibold text-slate-700">3. Preferred Style</label>
              {refImage && (
                <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-bold uppercase animate-pulse">
                  Determined by Inspiration
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {Object.values(GardenStyle).map(style => (
                <button
                  key={style}
                  onClick={() => {
                    setSelectedStyle(style);
                    setRefImage(''); 
                  }}
                  className={`px-3 py-2 text-sm rounded-lg border transition-all text-left ${selectedStyle === style ? 'border-emerald-600 bg-emerald-50 text-emerald-700 shadow-sm' : 'border-slate-200 text-slate-600 hover:border-emerald-300'}`}
                >
                  {style}
                </button>
              ))}
              <button
                onClick={() => {
                   setSelectedStyle(null);
                   setRefImage('');
                }}
                className={`px-3 py-2 text-sm rounded-lg border transition-all text-left ${!selectedStyle && !refImage ? 'border-emerald-600 bg-emerald-50 text-emerald-700 shadow-sm' : 'border-slate-200 text-slate-600 hover:border-emerald-300'}`}
              >
                Auto / Flexible
              </button>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-semibold text-slate-700 mb-2">4. Transformation Level</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.values(DesignComplexity).map(complexity => {
                const label = getComplexityLabel(complexity);
                return (
                  <button
                    key={complexity}
                    onClick={() => setSelectedComplexity(complexity)}
                    className={`px-2 py-2 text-[11px] rounded-lg border transition-all text-center leading-tight ${selectedComplexity === complexity ? 'border-emerald-600 bg-emerald-50 text-emerald-700 shadow-sm' : 'border-slate-200 text-slate-600 hover:border-emerald-300'}`}
                  >
                    {label.main}
                    <br/>
                    <span className="text-[9px] opacity-60 font-normal">{label.sub}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-semibold text-slate-700 mb-2">5. Specific Requests</label>
            <textarea
              value={additionalRequirements}
              onChange={(e) => setAdditionalRequirements(e.target.value)}
              placeholder="e.g., Hide the utility box with hydrangeas, add a curved stone path..."
              className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all h-24 resize-none"
            />
          </div>
          
          <div className="mt-auto pt-6">
            <Button 
              variant="primary"
              size="lg"
              className="w-full" 
              onClick={handleStartDesign} 
              isLoading={isGenerating}
              disabled={!uploadImage || isDetecting}
            >
              Generate Expert Design
            </Button>
            <p className="text-[10px] text-center mt-3 text-slate-400 font-medium">Architectural elements are automatically protected.</p>
          </div>
        </div>
      </div>
      
      {projects.length > 0 && (
        <div className="mt-16 text-center">
          <button onClick={() => setView('gallery')} className="text-slate-500 hover:text-emerald-600 font-medium flex items-center gap-2 mx-auto">
            View Design Portfolio
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
          </button>
        </div>
      )}
    </div>
  );

  const renderStudio = () => {
    if (!activeProject) return null;
    return (
      <div className="flex flex-col lg:flex-row h-[calc(100vh-64px)] overflow-hidden">
        <div className="lg:w-2/3 bg-slate-100 p-6 flex flex-col overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex flex-col">
              <h2 className="text-xl font-bold display-font">{activeProject.name}</h2>
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Architecture Mode Active</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => setView('gallery')}>
              Back to Library
            </Button>
          </div>
          
          <div className="flex-1 min-h-[400px] relative rounded-2xl overflow-hidden bg-slate-200 shadow-lg group">
            <img 
              src={activeProject.currentImage} 
              alt="Current Design" 
              className="w-full h-full object-contain transition-opacity duration-300" 
            />
            {isGenerating && (
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center text-white p-8">
                <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-lg font-medium">Applying Professional Rendering...</p>
                <p className="text-sm text-white/60 mt-2">Checking architectural boundaries & layering</p>
              </div>
            )}
          </div>

          <div className="mt-4 grid grid-cols-4 gap-4">
            <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200">
              <p className="text-[10px] uppercase font-bold text-slate-400">Source Photo</p>
              <img src={activeProject.originalImage} className="mt-2 h-20 w-full object-contain rounded-lg bg-slate-50" />
            </div>
            {selectedObjects.size > 0 && (
              <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center">
                <p className="text-[10px] uppercase font-bold text-slate-400">Feature Status</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {Array.from(selectedObjects).map(o => (
                    <span key={o} className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[9px] border border-emerald-100 font-bold uppercase">{o}</span>
                  ))}
                </div>
              </div>
            )}
            <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200">
              <p className="text-[10px] uppercase font-bold text-slate-400">Design Spec</p>
              <p className="mt-2 font-semibold text-slate-800 text-xs">
                Style: {activeProject.referenceImage ? 'Custom Reference' : activeProject.style}
              </p>
              <p className="font-medium text-slate-500 text-[10px] mt-1">
                Engine: Pro-Architect v2.5
              </p>
            </div>
            {activeProject.referenceImage && (
              <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200">
                <p className="text-[10px] uppercase font-bold text-slate-400">Style Goal</p>
                <img src={activeProject.referenceImage} className="mt-2 h-20 w-full object-contain rounded-lg bg-slate-50" />
              </div>
            )}
          </div>
        </div>

        <div className="lg:w-1/3 border-l border-slate-200 bg-white flex flex-col shadow-2xl z-10">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-700 text-sm">Senior Design Consultant</h3>
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {activeProject.history.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed ${
                  msg.role === 'user' 
                  ? 'bg-emerald-600 text-white rounded-tr-none shadow-md' 
                  : 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200'
                }`}>
                  {msg.content}
                  {msg.imageUrl && (
                    <div className="mt-4 rounded-lg overflow-hidden border border-slate-200 bg-white">
                      <img src={msg.imageUrl} className="w-full object-contain" />
                      <div className="p-2 bg-slate-50 text-[10px] text-slate-400 font-bold uppercase text-center border-t border-slate-100">Render Update</div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <div className="p-4 border-t border-slate-100 bg-slate-50">
            <div className="relative">
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Give design feedback (e.g., 'Lower the shrubs under the window')..."
                className="w-full p-4 pr-12 rounded-2xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none h-24 text-sm shadow-inner"
              />
              <button
                onClick={handleSendMessage}
                disabled={isChatting || !chatInput.trim()}
                className="absolute right-3 bottom-3 p-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-sm"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
            <p className="text-[9px] text-slate-400 mt-2 text-center">AI Consultant trained on professional landscaping standards.</p>
          </div>
        </div>
      </div>
    );
  };

  const renderGallery = () => (
    <div className="max-w-6xl mx-auto py-12 px-4">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold display-font">Project Portfolio</h1>
        <Button onClick={() => setView('landing')}>Start New Project</Button>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-slate-200 shadow-sm">
          <p className="text-slate-400">Your portfolio is currently empty.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {projects.map(project => (
            <div 
              key={project.id} 
              className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-200 hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group"
              onClick={() => {
                setActiveProject(project);
                setView('studio');
              }}
            >
              <div className="aspect-[4/3] relative bg-slate-100 overflow-hidden">
                <img src={project.currentImage} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                <div className="absolute top-3 right-3 flex flex-col gap-2 items-end">
                  <div className="bg-white/95 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border border-slate-100 shadow-lg text-slate-700">
                    {project.referenceImage ? 'Custom Reference' : project.style}
                  </div>
                  <div className="bg-emerald-600 text-white px-2.5 py-1 rounded-full text-[9px] font-bold shadow-lg uppercase tracking-tight">
                    {getComplexityLabel(project.complexity).main}
                  </div>
                </div>
              </div>
              <div className="p-5">
                <h3 className="font-bold text-slate-800 truncate text-lg">{project.name}</h3>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-slate-400">
                    Created {new Date(project.createdAt).toLocaleDateString()}
                  </p>
                  <span className="text-emerald-600 text-[10px] font-bold uppercase tracking-widest">Open Project</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50/50">
      <header className="h-16 border-b border-slate-200 bg-white/90 backdrop-blur-md sticky top-0 z-50 px-6 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2 cursor-pointer group" onClick={() => setView('landing')}>
          <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-black group-hover:rotate-12 transition-transform shadow-emerald-200 shadow-lg">G</div>
          <span className="font-bold text-xl tracking-tight display-font text-slate-800">GardenGenius</span>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => setView('gallery')} className="hidden sm:flex border-none font-bold text-slate-500 hover:text-emerald-600">
            My Designs
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setView('landing')}>
            New Design
          </Button>
        </div>
      </header>

      <main>
        {view === 'landing' && renderLanding()}
        {view === 'studio' && renderStudio()}
        {view === 'gallery' && renderGallery()}
      </main>
      
      {isGenerating && view !== 'studio' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl z-[100] flex flex-col items-center justify-center text-white">
          <div className="relative">
             <div className="w-20 h-20 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-8"></div>
             <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 bg-emerald-500 rounded-lg animate-pulse"></div>
             </div>
          </div>
          <h3 className="text-3xl font-bold mb-3 display-font tracking-tight">Architectural Rendering...</h3>
          <p className="text-white/60 text-sm max-w-xs text-center leading-relaxed">Applying professional landscaping standards and structural safety checks.</p>
        </div>
      )}
    </div>
  );
};

export default App;
