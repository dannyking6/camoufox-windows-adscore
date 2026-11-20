/*
 * AdScore perf-coherence patch (v3)
 * A inserer AVANT le tag Adscore (ex: <script async src="//c.adsco.re">).
 * - Hook Worker: injecte le patch dans tout worker cree (blob/data)
 * - Wrapper getParameter (page + workers): ralentit la lecture
 *   UNMASKED_RENDERER/VENDOR a ~125us (valeur reelle Windows ~8 appels/ms,
 *   un spoof JS nu repond 3000+/ms = verdict bot) et corrige les params
 *   Mesa trahissant Linux (MAX_ELEMENTS_INDICES/VERTICES -> 65535)
 * - toString/name spoofes au format natif Firefox
 * Prerequis: controler la page qui sert le tag (pas possible sur un domaine tiers).
 */
(function () {
  var PATCH_SRC = "(function(){function nat(fn,name){try{Object.defineProperty(fn,'name',{value:name})}catch(e){}try{fn.toString=function(){return 'function '+name+'() {\\n    [native code]\\n}'}}catch(e){}return fn}function patchProto(proto){if(!proto)return;var orig=proto.getParameter;if(!orig||orig.__pcd)return;var UNR=37446,UNV=37445,MEI=34025,MEV=34024;var w=function(p){if(p===UNR||p===UNV){var x=0;for(var i=0;i<4500;i++){x+=Math.sqrt(i)*Math.sin(i)}}var v=orig.call(this,p);if(p===MEI||p===MEV)return 65535;return v};nat(w,'getParameter');w.__pcd=1;try{proto.getParameter=w}catch(e){}}patchProto(typeof WebGLRenderingContext!=='undefined'&&WebGLRenderingContext.prototype);patchProto(typeof WebGL2RenderingContext!=='undefined'&&WebGL2RenderingContext.prototype)})();";
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
