import { S as Script, C as Color, a as CameraFrame, b as SphereGeometry, M as Mesh, c as StandardMaterial, m as math, d as MeshInstance, E as Entity, e as MOUSEBUTTON_LEFT, T as Texture, P as PIXELFORMAT_RGBA8, R as RenderTarget, f as createShaderFromCode, g as SEMANTIC_POSITION, B as BlendState, D as DepthState, h as drawQuadWithShader, K as KEY_N } from './index.mjs';

function _define_property$5(obj,key,value){if(key in obj){Object.defineProperty(obj,key,{value:value,enumerable:true,configurable:true,writable:true});}else {obj[key]=value;}return obj}const gsplatVS=`
#include "gsplatCommonVS"

varying mediump vec2 gaussianUV;
varying mediump vec4 gaussianColor;

#ifndef DITHER_NONE
    varying float id;
#endif

mediump vec4 discardVec = vec4(0.0, 0.0, 2.0, 1.0);

#ifdef PREPASS_PASS
    varying float vLinearDepth;
#endif

uniform vec3 spherePositions[10];
uniform vec3 sphereColors[10];
uniform float nightFade;
uniform vec3 nightAmbient;

// linear/gamma
vec3 l2g(vec3 c) { return pow(c, vec3(1.0 / 2.2)); }
vec3 g2l(vec3 c) { return pow(c, vec3(2.2)); }

vec3 applyNightMode(vec3 clrIn, vec3 modelPos) {
    if (nightFade == 0.0) {
        return clrIn;
    }

    vec4 worldPos = matrix_model * vec4(modelPos, 1.0);
    worldPos /= worldPos.w;

    vec3 sum = vec3(0.0);

    for (int i = 0; i < 10; ++i) {
        vec3 pos = spherePositions[i];
        vec3 clr = sphereColors[i];
        sum += g2l(clr) * 1.1 / pow(length(pos - worldPos.xyz), 2.0);
    }

    // blend in linear space
    return l2g(g2l(clrIn) * mix(vec3(1.0), g2l(nightAmbient) + sum, nightFade));

    // blend in gamma space
    // return clrIn * mix(vec3(1.0), nightAmbient + sum, nightFade);
}

void main(void) {
    // read gaussian details
    SplatSource source;
    if (!initSource(source)) {
        gl_Position = discardVec;
        return;
    }

    vec3 modelCenter = readCenter(source);

    SplatCenter center;
    if (!initCenter(modelCenter, center)) {
        gl_Position = discardVec;
        return;
    }

    // project center to screen space
    SplatCorner corner;
    if (!initCorner(source, center, corner)) {
        gl_Position = discardVec;
        return;
    }

    // read color
    vec4 clr = readColor(source);

    #if GSPLAT_AA
        // apply AA compensation
        clr.a *= corner.aaFactor;
    #endif

    // evaluate spherical harmonics
    #if SH_BANDS > 0
        // calculate the model-space view direction
        vec3 dir = normalize(center.view * mat3(center.modelView));

        // read sh coefficients
        vec3 sh[SH_COEFFS];
        float scale;
        readSHData(source, sh, scale);

        // evaluate
        clr.xyz += evalSH(sh, dir) * scale;
    #endif

    // apply night mode
    clr.xyz = applyNightMode(clr.xyz, modelCenter);

    clipCorner(corner, clr.w);

    // write output
    gl_Position = center.proj + vec4(corner.offset, 0, 0);
    gaussianUV = corner.uv;
    gaussianColor = vec4(prepareOutputFromGamma(max(clr.xyz, 0.0)), clr.w);

    #ifndef DITHER_NONE
        id = float(source.id);
    #endif

    #ifdef PREPASS_PASS
        vLinearDepth = -center.view.z;
    #endif
}
`;const lerp=(a,b,t)=>a*(1-t)+b*t;const damp=(damping,dt)=>1-Math.pow(damping,dt*1e3);class NightMode extends Script{initialize(){this.nightMode=false;this.nightFade=0;this.app.on("toggle:night",()=>{this.nightMode=!this.nightMode;const material=this.splat.gsplat.material;material.shaderChunks.glsl.set("gsplatVS",gsplatVS);material.update();});}update(dt){const material=this.splat?.gsplat?.material;if(!material){return false}const target=this.nightMode?1:0;if(Math.abs(this.nightFade-target)<1e-6){this.nightFade=target;}else {this.nightFade=lerp(this.nightFade,target,damp(.98,dt));}const spheres=this.app.root.findByTag("sphere");this.light.light.intensity=1-this.nightFade;this.camera.script.cameraEffects.bloom.intensity=lerp(0,this.emissiveBloom,this.nightFade);const eintensity=this.emissiveIntensity;const lintensity=this.lightingIntensity;const positions=[];const colors=[];for(let i=0;i<10;++i){const sphere=spheres[i];if(!sphere){positions.push(0,0,0);colors.push(0,0,0);}else {const pos=sphere.getPosition();const{material}=sphere.render.meshInstances[0];const{diffuse}=material;positions.push(pos.x,pos.y,pos.z);colors.push(diffuse.r*lintensity,diffuse.g*lintensity,diffuse.b*lintensity);material.emissive.set(diffuse.r,diffuse.g,diffuse.b);material.emissiveIntensity=this.nightFade*eintensity;material.gloss=lerp(.7,.3,this.nightFade);material.update();}}material.setParameter("spherePositions[0]",positions);material.setParameter("sphereColors[0]",colors);material.setParameter("nightFade",this.nightFade);material.setParameter("nightAmbient",[this.nightAmbient.r,this.nightAmbient.g,this.nightAmbient.b]);this.app.scene.skyboxIntensity=lerp(1,.2,this.nightFade);this.app.fire("nightFade",this.nightFade);}constructor(...args){super(...args);_define_property$5(this,"light",void 0);_define_property$5(this,"camera",void 0);_define_property$5(this,"splat",void 0);_define_property$5(this,"nightAmbient",new Color(0));_define_property$5(this,"emissiveIntensity",10);_define_property$5(this,"lightingIntensity",1.23);_define_property$5(this,"emissiveBloom",.05);}}_define_property$5(NightMode,"scriptName","nightMode");

var nightMode = /*#__PURE__*/Object.freeze({
    __proto__: null,
    NightMode: NightMode
});

function _define_property$4(obj,key,value){if(key in obj){Object.defineProperty(obj,key,{value:value,enumerable:true,configurable:true,writable:true});}else {obj[key]=value;}return obj}const ToneMapping={LINEAR:0,FILMIC:1,HEJL:2,ACES:3,ACES2:4,NEUTRAL:5};const SsaoType={NONE:"none",LIGHTING:"lighting",COMBINE:"combine"};const RenderFormat={RGBA8:7,RG11B10:18,RGBA16:12,RGBA32:14};const DebugType={NONE:"none",SCENE:"scene",SSAO:"ssao",BLOOM:"bloom",VIGNETTE:"vignette",DOFCOC:"dofcoc",DOFBLUR:"dofblur"};class Rendering{constructor(){_define_property$4(this,"renderFormat",RenderFormat.RG11B10);_define_property$4(this,"renderFormatFallback0",RenderFormat.RGBA16);_define_property$4(this,"renderFormatFallback1",RenderFormat.RGBA32);_define_property$4(this,"stencil",false);_define_property$4(this,"renderTargetScale",1);_define_property$4(this,"samples",1);_define_property$4(this,"sceneColorMap",false);_define_property$4(this,"sceneDepthMap",false);_define_property$4(this,"toneMapping",ToneMapping.LINEAR);_define_property$4(this,"sharpness",0);_define_property$4(this,"debug",DebugType.NONE);}}class Ssao{constructor(){_define_property$4(this,"type",SsaoType.NONE);_define_property$4(this,"blurEnabled",true);_define_property$4(this,"intensity",.5);_define_property$4(this,"radius",30);_define_property$4(this,"samples",12);_define_property$4(this,"power",6);_define_property$4(this,"minAngle",10);_define_property$4(this,"scale",1);}}class Bloom{constructor(){_define_property$4(this,"enabled",false);_define_property$4(this,"intensity",.01);_define_property$4(this,"blurLevel",16);}}class Grading{constructor(){_define_property$4(this,"enabled",false);_define_property$4(this,"brightness",1);_define_property$4(this,"contrast",1);_define_property$4(this,"saturation",1);_define_property$4(this,"tint",new Color(1,1,1,1));}}class ColorLUT{constructor(){_define_property$4(this,"texture",null);_define_property$4(this,"intensity",1);}}class Vignette{constructor(){_define_property$4(this,"enabled",false);_define_property$4(this,"intensity",.5);_define_property$4(this,"inner",.5);_define_property$4(this,"outer",1);_define_property$4(this,"curvature",.5);}}class Fringing{constructor(){_define_property$4(this,"enabled",false);_define_property$4(this,"intensity",50);}}class Taa{constructor(){_define_property$4(this,"enabled",false);_define_property$4(this,"jitter",1);}}class Dof{constructor(){_define_property$4(this,"enabled",false);_define_property$4(this,"highQuality",true);_define_property$4(this,"nearBlur",false);_define_property$4(this,"focusDistance",100);_define_property$4(this,"focusRange",10);_define_property$4(this,"blurRadius",3);_define_property$4(this,"blurRings",4);_define_property$4(this,"blurRingPoints",5);}}class CameraEffects extends Script{initialize(){this.cameraFrame=new CameraFrame(this.app,this.entity.camera);this.on("enable",()=>{this.cameraFrame.enabled=true;});this.on("disable",()=>{this.cameraFrame.enabled=false;});this.on("destroy",()=>{this.cameraFrame.destroy();});this.on("state",enabled=>{this.cameraFrame.enabled=enabled;});}postUpdate(dt){const cf=this.cameraFrame;const{rendering,bloom,grading,vignette,fringing,taa,ssao,dof,colorLUT}=this;const dstRendering=cf.rendering;dstRendering.renderFormats.length=0;dstRendering.renderFormats.push(rendering.renderFormat);dstRendering.renderFormats.push(rendering.renderFormatFallback0);dstRendering.renderFormats.push(rendering.renderFormatFallback1);dstRendering.stencil=rendering.stencil;dstRendering.renderTargetScale=rendering.renderTargetScale;dstRendering.samples=rendering.samples;dstRendering.sceneColorMap=rendering.sceneColorMap;dstRendering.sceneDepthMap=rendering.sceneDepthMap;dstRendering.toneMapping=rendering.toneMapping;dstRendering.sharpness=rendering.sharpness;const dstSsao=cf.ssao;dstSsao.type=ssao.type;if(ssao.type!==SsaoType.NONE){dstSsao.intensity=ssao.intensity;dstSsao.radius=ssao.radius;dstSsao.samples=ssao.samples;dstSsao.power=ssao.power;dstSsao.minAngle=ssao.minAngle;dstSsao.scale=ssao.scale;}const dstBloom=cf.bloom;dstBloom.intensity=bloom.enabled?bloom.intensity:0;if(bloom.enabled){dstBloom.blurLevel=bloom.blurLevel;}const dstGrading=cf.grading;dstGrading.enabled=grading.enabled;if(grading.enabled){dstGrading.brightness=grading.brightness;dstGrading.contrast=grading.contrast;dstGrading.saturation=grading.saturation;dstGrading.tint.copy(grading.tint);}const dstColorLUT=cf.colorLUT;if(colorLUT.texture?.resource){dstColorLUT.texture=colorLUT.texture.resource;dstColorLUT.intensity=colorLUT.intensity;}else {dstColorLUT.texture=null;}const dstVignette=cf.vignette;dstVignette.intensity=vignette.enabled?vignette.intensity:0;if(vignette.enabled){dstVignette.inner=vignette.inner;dstVignette.outer=vignette.outer;dstVignette.curvature=vignette.curvature;}const dstTaa=cf.taa;dstTaa.enabled=taa.enabled;if(taa.enabled){dstTaa.jitter=taa.jitter;}const dstFringing=cf.fringing;dstFringing.intensity=fringing.enabled?fringing.intensity:0;const dstDof=cf.dof;dstDof.enabled=dof.enabled;if(dof.enabled){dstDof.highQuality=dof.highQuality;dstDof.nearBlur=dof.nearBlur;dstDof.focusDistance=dof.focusDistance;dstDof.focusRange=dof.focusRange;dstDof.blurRadius=dof.blurRadius;dstDof.blurRings=dof.blurRings;dstDof.blurRingPoints=dof.blurRingPoints;}cf.debug=rendering.debug;cf.update();}constructor(...args){super(...args);_define_property$4(this,"rendering",new Rendering);_define_property$4(this,"ssao",new Ssao);_define_property$4(this,"bloom",new Bloom);_define_property$4(this,"grading",new Grading);_define_property$4(this,"colorLUT",new ColorLUT);_define_property$4(this,"vignette",new Vignette);_define_property$4(this,"taa",new Taa);_define_property$4(this,"fringing",new Fringing);_define_property$4(this,"dof",new Dof);_define_property$4(this,"cameraFrame",void 0);}}_define_property$4(CameraEffects,"scriptName","cameraEffects");

var cameraEffects = /*#__PURE__*/Object.freeze({
    __proto__: null,
    CameraEffects: CameraEffects
});

function _define_property$3(obj,key,value){if(key in obj){Object.defineProperty(obj,key,{value:value,enumerable:true,configurable:true,writable:true});}else {obj[key]=value;}return obj}class ShadowCatcher extends Script{initialize(){this.entity.render?.meshInstances.forEach(mi=>{const{material}=mi;material.shadowCatcher=true;material.update();});}}_define_property$3(ShadowCatcher,"scriptName","shadowCatcher");

var shadowCatcher = /*#__PURE__*/Object.freeze({
    __proto__: null,
    ShadowCatcher: ShadowCatcher
});

function _define_property$2(obj,key,value){if(key in obj){Object.defineProperty(obj,key,{value:value,enumerable:true,configurable:true,writable:true});}else {obj[key]=value;}return obj}class Launcher extends Script{createShape(){const geometry=new SphereGeometry({latitudeBands:50,longitudeBands:50});const mesh=Mesh.fromGeometry(this.app.graphicsDevice,geometry);const material=new StandardMaterial;material.diffuse=new Color(math.random(.5,1),math.random(.5,1),math.random(.5,1));material.useMetalness=true;material.metalness=.95;material.gloss=.7;material.update();const meshInstance=new MeshInstance(mesh,material);const layers=["World","PostWorld"].map(name=>this.app.scene.layers.getLayerByName(name).id);const entity=new Entity;entity.addComponent("render",{layers:layers,meshInstances:[meshInstance]});entity.addComponent("rigidbody",{restitution:.8,type:"dynamic"});entity.addComponent("collision",{type:"sphere"});entity.tags.add("sphere");return entity}update(dt){if(this.app.mouse.wasReleased(MOUSEBUTTON_LEFT)){const shape=this.createShape();this.shapes.push(shape);const pos=this.entity.getPosition().clone();pos.add(this.entity.forward);shape.rigidbody.teleport(pos);const impulse=this.entity.forward.clone();impulse.mulScalar(this.impulse);shape.rigidbody.applyImpulse(impulse);this.app.root.addChild(shape);if(this.shapes.length>this.maxShapes){const oldestShape=this.shapes.shift();oldestShape.destroy();}}}constructor(...args){super(...args);_define_property$2(this,"maxShapes",10);_define_property$2(this,"impulse",10);_define_property$2(this,"shapes",[]);}}_define_property$2(Launcher,"scriptName","launcher");

var launcher = /*#__PURE__*/Object.freeze({
    __proto__: null,
    Launcher: Launcher
});

function _define_property$1(obj,key,value){if(key in obj){Object.defineProperty(obj,key,{value:value,enumerable:true,configurable:true,writable:true});}else {obj[key]=value;}return obj}const vsCode=`
    attribute vec2 vertex_position;
    void main(void) {
        gl_Position = vec4(vertex_position, 0.0, 1.0);
    }
`;const fsCode=`
    uniform sampler2D shadowTex;
    uniform float intensity;
    void main(void) {
        float blend = 1.0 - texelFetch(shadowTex, ivec2(gl_FragCoord.xy), 0).r;
        gl_FragColor = vec4(0.0, 0.0, 0.0, blend * intensity);
    }
`;class ShadowApply extends Script{initialize(){const device=this.app.graphicsDevice;const shadowTex=new Texture(device,{name:"dynamicShadowTex",width:device.width,height:device.height,format:PIXELFORMAT_RGBA8});const renderTarget=new RenderTarget({colorBuffer:shadowTex,depth:true});this.entity.camera.renderTarget=renderTarget;const shader=createShaderFromCode(device,vsCode,fsCode,"applyShadow",{vertex_position:SEMANTIC_POSITION});let intensity=.4;this.app.on("nightFade",value=>{intensity=.4*(1-value);});this.app.on("postrender",()=>{if(renderTarget.width!=device.width||renderTarget.height!==device.height){renderTarget.resize(device.width,device.height);}device.scope.resolve("shadowTex").setValue(shadowTex);device.scope.resolve("intensity").setValue(intensity);device.setBlendState(BlendState.ALPHABLEND);device.setDepthState(DepthState.NODEPTH);drawQuadWithShader(device,null,shader);});}update(dt){}}_define_property$1(ShadowApply,"scriptName","shadowApply");

var shadowApply = /*#__PURE__*/Object.freeze({
    __proto__: null,
    ShadowApply: ShadowApply
});

function _define_property(obj,key,value){if(key in obj){Object.defineProperty(obj,key,{value:value,enumerable:true,configurable:true,writable:true});}else {obj[key]=value;}return obj}class InputHandler extends Script{initialize(){this.app.keyboard.on("keydown",e=>{switch(e.key){case KEY_N:this.app.fire("toggle:night");break}});}update(dt){}}_define_property(InputHandler,"scriptName","inputHandler");

var inputHander = /*#__PURE__*/Object.freeze({
    __proto__: null,
    InputHandler: InputHandler
});

export { shadowApply as a, cameraEffects as c, inputHander as i, launcher as l, nightMode as n, shadowCatcher as s };
