/*
 * AdScore perf-coherence patch (v4) - valide 3/3 proxy avec canvas noise ON.
 * v4 ajoute: ralentissement getContext('2d') de 60ms -> la sonde canvas s35
 * d'AdScore timeout deterministiquement (-3) -> aucune preuve canvas
 * incoherente n'est collectee. A inserer AVANT le tag Adscore.
 * Necessite de controler la page qui sert le tag.
 */
(function () {
  var PATCH_SRC = "(function(){function nat(fn,name){try{Object.defineProperty(fn,'name',{value:name})}catch(e){}try{fn.toString=function(){return 'function '+name+'() {\\n    [native code]\\n}'}}catch(e){}return fn}function patchProto(proto){if(!proto)return;var orig=proto.getParameter;if(!orig||orig.__pcd)return;var UNR=37446,UNV=37445,MEI=34025,MEV=34024;var w=function(p){if(p===UNR||p===UNV){var x=0;for(var i=0;i<4500;i++){x+=Math.sqrt(i)*Math.sin(i)}}var v=orig.call(this,p);if(p===MEI||p===MEV)return 65535;return v};nat(w,'getParameter');w.__pcd=1;try{proto.getParameter=w}catch(e){}}patchProto(typeof WebGLRenderingContext!=='undefined'&&WebGLRenderingContext.prototype);patchProto(typeof WebGL2RenderingContext!=='undefined'&&WebGL2RenderingContext.prototype);function slow2d(proto){if(!proto)return;var o=proto.getContext;if(!o||o.__pcd2)return;var w=function(t,attrs){if(t==='2d'){var t0=performance.now();while(performance.now()-t0<60){}}return o.call(this,t,attrs)};nat(w,'getContext');w.__pcd2=1;try{proto.getContext=w}catch(e){}}slow2d(typeof HTMLCanvasElement!=='undefined'&&HTMLCanvasElement.prototype)})();";
  function hookWorker(W) {
    return function (url, opts) {
      var u = String(url), src = null;
      try {
        if (u.indexOf('blob:') === 0 || u.indexOf('data:') === 0) {
          var x = new XMLHttpRequest(); x.open('GET', u, false); x.send(); src = x.responseText;
        }
      } catch (e) {}
      if (src != null && src.length) {
        try { url = URL.createObjectURL(new Blob([PATCH_SRC, "\n", src], { type: 'application/javascript' })); } catch (e) {}
      }
      return new W(url, opts);
    };
  }
  try { window.Worker = hookWorker(window.Worker); } catch (e) {}
  var s = document.createElement('script');
  s.textContent = PATCH_SRC;
  (document.head || document.documentElement).appendChild(s);
})();
