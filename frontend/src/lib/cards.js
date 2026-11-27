// Shared card class strings (#50). Pages add to these rather than
// redefining them.

// The forecast pages' metric cards: lift by 2px with the offset shadow on
// hover. (The landing page's cards also change colour; they keep their own.)
export const cardHover =
  "transition-[background-color,box-shadow,transform] " +
  "duration-200 hover:-translate-y-[2px] " +
  "hover:shadow-offset motion-reduce:transform-none";
