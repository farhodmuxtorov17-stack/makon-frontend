<template>
  <svg viewBox="0 0 280 210" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="abFront" x1="70" y1="60" x2="150" y2="185">
        <stop stop-color="#4E8BFB" />
        <stop offset="1" stop-color="#0148DB" />
      </linearGradient>
      <linearGradient id="abSide" x1="150" y1="70" x2="215" y2="180">
        <stop stop-color="#1E6BF9" />
        <stop offset="1" stop-color="#0139B0" />
      </linearGradient>
      <linearGradient id="abRoof" x1="70" y1="20" x2="215" y2="80">
        <stop stop-color="#8FC5FD" />
        <stop offset="1" stop-color="#3F94F7" />
      </linearGradient>
      <linearGradient id="abGround" x1="20" y1="150" x2="260" y2="205">
        <stop stop-color="#D8EAFE" />
        <stop offset="1" stop-color="#C2F0E6" />
      </linearGradient>
    </defs>

    <!-- Zamin -->
    <ellipse cx="140" cy="176" rx="122" ry="30" fill="url(#abGround)" />

    <!-- Orqa binolar -->
    <path d="M32 150V96l30-13v67z" fill="#BBD6FB" />
    <path d="M62 150V83l22 9v58z" fill="#9EC3F9" />
    <path d="M248 150V104l-28-12v58z" fill="#BBD6FB" />
    <path d="M220 150V92l-20 8v50z" fill="#9EC3F9" />

    <!-- Asosiy bino -->
    <path d="M84 165V58l56-24v131z" fill="url(#abFront)" />
    <path d="M140 165V34l56 24v107z" fill="url(#abSide)" />
    <path d="M84 58l56-24 56 24-56 23z" fill="url(#abRoof)" />

    <!-- Old tomondagi oynalar -->
    <g fill="#FFFFFF" fill-opacity=".82">
      <rect x="95" y="72" width="13" height="10" rx="2" />
      <rect x="113" y="65" width="13" height="10" rx="2" />
      <rect x="95" y="92" width="13" height="10" rx="2" />
      <rect x="113" y="85" width="13" height="10" rx="2" />
      <rect x="95" y="112" width="13" height="10" rx="2" />
      <rect x="113" y="105" width="13" height="10" rx="2" />
      <rect x="95" y="132" width="13" height="10" rx="2" />
      <rect x="113" y="125" width="13" height="10" rx="2" />
    </g>

    <!-- Yon tomondagi oynalar -->
    <g fill="#FFFFFF" fill-opacity=".55">
      <rect x="152" y="66" width="12" height="10" rx="2" />
      <rect x="170" y="74" width="12" height="10" rx="2" />
      <rect x="152" y="86" width="12" height="10" rx="2" />
      <rect x="170" y="94" width="12" height="10" rx="2" />
      <rect x="152" y="106" width="12" height="10" rx="2" />
      <rect x="170" y="114" width="12" height="10" rx="2" />
      <rect x="152" y="126" width="12" height="10" rx="2" />
      <rect x="170" y="134" width="12" height="10" rx="2" />
    </g>

    <!-- Kirish -->
    <path d="M126 165v-24h14v24z" fill="#0B2E70" fill-opacity=".55" />

    <!-- Daraxtlar -->
    <g>
      <rect x="66" y="150" width="4" height="12" rx="2" fill="#0A5540" />
      <circle cx="68" cy="144" r="11" fill="#16B99A" />
      <rect x="210" y="152" width="4" height="11" rx="2" fill="#0A5540" />
      <circle cx="212" cy="146" r="9" fill="#3FBDA8" />
    </g>

    <!-- Bayroqcha -->
    <path d="M140 34V16" stroke="#16B99A" stroke-width="2.4" stroke-linecap="round" />
    <path d="M141 17h16l-4 5 4 5h-16z" fill="#16B99A" />
  </svg>
</template>
