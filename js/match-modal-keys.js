// Alt+Arrow field navigation for the add/edit match modal.
//
// The modal is a CSS grid, so DOM order and reading order diverge: Alt+Left /
// Alt+Right walk along the visual row, Alt+Up / Alt+Down land on the field
// directly above or below. Geometry is measured live from getBoundingClientRect,
// so a responsive reflow needs no changes here.
//
// Plain arrow keys are deliberately untouched: they still step the number
// inputs, move the caret in text fields and drive the open combobox dropdowns.
(function initMatchModalArrowNav(){
 const form=document.getElementById("matchForm");
 if(!form)return;

 const FOCUSABLE="input:not([type=hidden]):not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled]),summary";
 const DROPDOWNS=[".agent-dropdown",".map-dropdown",".rank-dropdown"];
 const ANY_DROPDOWN=DROPDOWNS.join(",");
 const OPEN_DROPDOWN=DROPDOWNS.map(s=>`${s}:not(.hidden)`).join(",");
 const ARROWS=["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"];

 // Fields are collected per keypress rather than cached: the Advanced options
 // <details> changes what is reachable, and an edit may reflow the grid.
 //
 // A collapsed <details> needs its own check. `.advanced-grid` sets
 // `display:grid`, which overrides the UA rule that hides closed details
 // content, so those fields are still laid out and still report client rects --
 // they are merely clipped by `overflow:hidden`. Landing focus on one would
 // scroll to a field nobody can see.
 function fields(){
  return [...form.querySelectorAll(FOCUSABLE)].filter(el=>
   !el.closest(ANY_DROPDOWN)              // skip search boxes and option buttons
   && !insideCollapsedDetails(el)         // skip collapsed Advanced options
   && el.getClientRects().length>0
  );
 }

 // The <summary> is a child of the <details> it toggles, so it stays reachable
 // even while the panel is shut -- that is how the panel gets opened.
 function insideCollapsedDetails(el){
  const details=el.closest("details:not([open])");
  return !!details && el!==details.querySelector("summary");
 }

 const box=el=>{const r=el.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2,top:r.top,bottom:r.bottom}};

 // Two fields share a row when their vertical spans overlap; comboboxes and
 // number inputs differ in height, so an exact top match is too strict.
 const sameRow=(a,b)=>a.top<b.bottom-4&&b.top<a.bottom-4;

 function target(list,from,key){
  const here=box(from);
  const others=list.filter(el=>el!==from).map(el=>({el,at:box(el)}));

  if(key==="ArrowLeft"||key==="ArrowRight"){
   const dir=key==="ArrowRight"?1:-1;
   const row=others
    .filter(({at})=>sameRow(here,at)&&(at.x-here.x)*dir>1)
    .sort((a,b)=>(a.at.x-b.at.x)*dir);
   if(row.length)return row[0].el;
  }else{
   const dir=key==="ArrowDown"?1:-1;
   const ahead=others
    .filter(({at})=>!sameRow(here,at)&&(at.y-here.y)*dir>1)
    .sort((a,b)=>(a.at.y-b.at.y)*dir);
   if(ahead.length){
    // Of the nearest row, take the field closest to the current column.
    const edge=ahead[0].at.y;
    return ahead
     .filter(({at})=>Math.abs(at.y-edge)<4)
     .sort((a,b)=>Math.abs(a.at.x-here.x)-Math.abs(b.at.x-here.x))[0].el;
   }
  }

  // Row ends and the top/bottom of the grid fall back to DOM order, so no
  // direction is ever a dead end.
  const step=key==="ArrowRight"||key==="ArrowDown"?1:-1;
  return list[list.indexOf(from)+step]||null;
 }

 // Capture phase: an Alt+Arrow is consumed here so the combobox handlers on the
 // fields below never see it and their behaviour stays exactly as it was.
 form.addEventListener("keydown",e=>{
  if(!e.altKey||e.ctrlKey||e.metaKey||e.shiftKey)return;
  if(!ARROWS.includes(e.key))return;
  if(form.querySelector(OPEN_DROPDOWN))return;   // an open list keeps its own arrows

  const list=fields();
  const from=list.includes(document.activeElement)?document.activeElement:list[0];
  if(!from)return;

  const next=target(list,from,e.key);
  if(!next)return;

  e.preventDefault();
  e.stopPropagation();
  next.focus();
  // Selecting the current value lets the next keystroke overwrite it. Readonly
  // comboboxes are skipped: highlighting a value you cannot type over is noise.
  if(next.select&&!next.readOnly&&next.tagName==="INPUT")next.select();
 },true);
})();
