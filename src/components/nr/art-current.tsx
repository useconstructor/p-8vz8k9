"use client";

const bone = "#F2EFE8", ink = "#201D1B", oak = "#725039", steel = "#A5AEAA", wine = "#743746";

/** Additive presentation: existing saved version 1 references keep their renderer. */
export function ProfileV2({ kind }: { kind: string }) {
    const beard = kind === "barba" || kind === "corte-barba";
    const groomed = kind === "corte" || kind === "corte-barba";
    const towel = kind === "afeitado-toalla";
    return <svg className="profile-art" viewBox="0 0 480 280" role="img"
        aria-label={`Referencia ${kind.replaceAll("-", " ")}, versión 2`} data-profile={kind} data-presentation-version="2">
        <path fill="#DEDCD2" d="M0 0H480V280H0Z" />
        <path fill="#D2D3C9" d="M318 0H480V280H228Z" />
        <g transform={towel ? "translate(67 -24) rotate(24 235 149)" : undefined} strokeLinejoin="round">
            {/* The cut, jaw and collar share the same measured bevel. */}
            <path d="M143 272 155 244Q168 227 201 224L211 202 255 193 255 224Q290 232 310 253L320 272Z" fill={wine} />
            <path d="M200 183 253 183V225L231 244 196 225Q210 210 200 183Z" fill="#B09176" />
            <path d="M189 81Q204 53 241 57Q278 61 285 91L282 114Q284 125 292 137L300 148Q302 153 291 155L283 156 282 171Q287 177 280 180L279 190Q276 203 254 207Q225 209 207 189L193 166Q178 154 178 130Z" fill="#CEB69C" stroke={ink} strokeWidth="2.5" />
            <path d="M252 80Q270 89 267 118L264 143 271 160 265 174Q264 191 247 199L258 203Q276 201 278 190L279 180 276 171 283 156 292 153Q299 152 296 147L284 128 279 115 283 92Z" fill="#B4977D" />
            <path d="M266 120Q273 116 280 120M270 128 280 129M281 157 275 159M270 174 281 174" fill="none" stroke={ink} strokeWidth="2" strokeLinecap="round" />
            <path d="M204 139Q192 128 188 140Q185 149 197 161L201 167 207 162" fill="#CEB69C" stroke={oak} strokeWidth="2" />
            <path d="M193 144Q201 140 201 153L196 151" fill="none" stroke={oak} strokeWidth="1.5" />
            {groomed ? <>
                <path d="M188 149 179 132Q171 108 180 84Q188 56 214 46Q238 36 263 48Q282 49 294 64L286 86Q266 76 250 85L217 100 207 137 201 139 198 130 191 135Z" fill={ink} />
                <path d="M189 93Q221 58 280 65M190 104Q219 78 260 76M202 80Q228 59 256 58" fill="none" stroke={steel} strokeWidth="1.6" strokeLinecap="round" />
                <path d="M216 101Q209 114 209 126" fill="none" stroke={oak} strokeWidth="2" />
            </> : <>
                <path d="M189 142 180 126Q170 101 184 78Q198 52 229 51Q260 50 280 70L286 87Q266 75 247 78L216 87 202 128 198 129 193 131Z" fill={oak} />
                <path d="M189 104Q201 73 226 65M198 111Q211 81 240 70M209 102Q226 81 253 77" fill="none" stroke="#A88B71" strokeWidth="1.5" />
            </>}
            {beard && <>
                <path d="M204 153Q214 164 222 174L244 181Q263 185 281 168L282 193Q276 211 254 222L231 216Q211 205 206 182L199 165Z" fill={ink} />
                <path d="M256 164Q271 153 283 164L281 170Q270 167 259 172Z" fill={ink} />
                <path d="M216 187Q225 205 242 210M228 189Q239 205 251 207M258 207 272 195" fill="none" stroke={oak} strokeWidth="1.5" strokeLinecap="round" />
            </>}
            {towel ? <>
                <path d="M178 111Q216 102 250 115L283 132 277 153Q245 134 210 134L181 138Z" fill={bone} stroke={steel} strokeWidth="2" />
                <path d="M186 118Q225 115 268 138M190 127Q224 122 259 137" fill="none" stroke={steel} strokeWidth="1.5" />
                <path d="M161 243 195 211Q216 224 252 218L282 241 310 272H147Z" fill={bone} stroke={steel} strokeWidth="2" />
                <path d="M178 235 262 259M169 246 246 267M204 228 278 252" fill="none" stroke={steel} strokeWidth="1.5" />
            </> : <>
                <path d="M194 223 231 244 254 223 267 234 245 256 231 245 220 261 183 234Z" fill={bone} />
                <path d="M232 252 237 272M161 252 190 242M276 244 302 258" fill="none" stroke="#AE7780" strokeWidth="1.5" />
            </>}
        </g>
        <path d="M32 252H110M371 28H447" fill="none" stroke={oak} strokeWidth="2" />
    </svg>;
}

export function EditorialBust({ person }: { person: string }) {
    const julian = person === "julian", samuel = person === "samuel";
    const skin = samuel ? "#AA896F" : "#CCB39B";
    const shade = samuel ? "#84654F" : "#AE8E73";
    const name = person === "tomas" ? "Tomás" : julian ? "Julián" : "Samuel";
    return <svg viewBox="0 0 320 320" preserveAspectRatio="xMidYMax meet" className={`team-bust team-bust-${person}`} role="img" aria-label={`Retrato vectorial ficticio de ${name}`}>
        <path d={julian ? "M12 320 20 268Q24 242 72 232L126 218H192L248 230Q291 240 300 270L308 320Z" : samuel ? "M43 320 48 272Q53 250 90 236L126 218H192L227 239Q260 254 270 278L278 320Z" : "M27 320 32 270Q37 246 76 232L126 218H192L239 233Q279 246 285 269L293 320Z"} fill={julian ? oak : samuel ? ink : wine} />
        <g transform={julian ? "translate(-16 15) scale(1.1 .94)" : samuel ? "translate(18 -12) scale(.89 1.055)" : "translate(0 0)"}><path d="M132 189H186L192 223 160 250 126 222Z" fill={shade} />
        <path d="M107 105Q110 62 155 55Q196 49 213 87L214 125 206 167Q202 184 183 202L158 213Q141 211 124 193Q108 176 108 151Z" fill={skin} stroke={ink} strokeWidth="2.5" />
        <path d="M175 65Q201 77 202 104L196 144 201 159 190 176Q192 192 171 207L183 202Q203 186 207 168L214 124 210 89Z" fill={shade} />
        <path d="M111 128Q98 119 98 133Q98 148 111 154M209 127Q220 120 219 134L212 149" fill={skin} stroke={ink} strokeWidth="2" />
        <path d="M104 132 110 142M212 135 215 130" fill="none" stroke={oak} strokeWidth="1.5" />
        {samuel ? <>
            <path d="M109 133 102 107 101 71Q103 47 123 46L129 37 147 42 157 32 174 41 189 37 199 49Q217 52 218 78L213 124 204 113 200 89Q164 96 120 89L117 127Z" fill={ink} />
            <path d="M122 71Q157 51 191 70M126 81Q163 66 194 79" fill="none" stroke={steel} strokeWidth="1.5" />
            <path d="M113 159 133 171 158 179 183 172 205 155 200 183Q188 207 163 217Q132 211 119 188Z" fill={ink} />
            <path d="M139 173Q158 164 179 173L181 183 158 180 138 183Z" fill={ink} />
            <path d="M134 193 148 205M157 191 161 207M180 191 173 202" stroke={steel} strokeWidth="1.3" />
        </> : julian ? <>
            <path d="M106 130 99 108Q91 76 117 51Q138 32 168 44Q202 39 219 70L218 105 209 126 202 114 201 86Q168 99 122 83L117 117 113 131Z" fill={ink} />
            <path d="M114 72Q147 51 192 65M119 80Q154 65 186 74" stroke={oak} strokeWidth="1.5" fill="none" />
            <path d="M111 154 127 162 138 176 158 182 181 173 208 150 201 189Q189 211 163 226L139 216 119 195Z" fill={ink} />
            <path d="M140 172Q160 160 181 171L184 180 162 177 138 180Z" fill={ink} />
            <path d="M129 190 142 205M147 194 159 212M177 193 169 208" stroke={oak} strokeWidth="1.5" />
        </> : <>
            <path d="M107 131 100 108Q96 75 117 52Q136 32 162 36Q195 32 220 59L217 80 202 91 195 79Q167 101 122 96L118 121 114 132Z" fill={ink} />
            <path d="M113 82Q149 49 207 59M118 89Q153 66 196 69M128 68Q151 49 180 48" stroke={steel} strokeWidth="1.5" fill="none" strokeLinecap="round" />
            <path d="M143 181Q159 187 178 178M147 190 169 189" stroke={oak} strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </>}
        <path d="M123 127Q133 122 143 127M178 125Q188 120 197 125M127 135 139 135M181 134 192 133M161 134 156 157Q161 161 168 157" stroke={ink} strokeWidth="2" fill="none" strokeLinecap="round" />
        </g><path d="M124 219 160 247 192 219 208 232 182 264 160 249 142 267 108 232Z" fill={bone} />
        <path d="M160 250 166 320M72 241 92 320M239 245 223 320" fill="none" stroke={julian ? "#AC8B6D" : samuel ? steel : "#B07982"} strokeWidth="1.5" />
        <path d="M102 277H143V302H105Z" fill="none" stroke={bone} strokeWidth="1.5" />
        <path d="M107 283H138" stroke={bone} strokeWidth="1.5" />
        <path d="M178 275H215V280H178Z" fill={steel} />
        <path d="M182 280V300M188 280V300M194 280V300M200 280V300M206 280V300" stroke={steel} strokeWidth="2" />
    </svg>;
}

export function WorkshopChair() {
    return <svg viewBox="0 0 1000 430" className="chair-art" role="img" aria-label="Sillón de barbería completo, ilustración original">
        <defs><pattern id="nr-grain" width="140" height="430" patternUnits="userSpaceOnUse"><path d="M24 0Q14 100 28 211T24 430M31 0Q23 100 35 211T31 430" fill="none" stroke={oak} strokeWidth="1" opacity=".1" /></pattern></defs>
        <path d="M0 0H1000V430H0Z" fill="#DEDCD2" /><path d="M0 0H1000V430H0Z" fill="url(#nr-grain)" />
        <path d="M685 0H1000V350H570Z" fill="#D1D3CA" /><path d="M0 350H1000" stroke={steel} />
        <ellipse cx="500" cy="403" rx="158" ry="9" fill={ink} opacity=".12" />
        <g stroke={ink} strokeWidth="2.5" strokeLinejoin="round">
            <path d="M407 386Q407 368 500 367Q593 368 593 386V391Q581 408 500 409Q419 408 407 391Z" fill={steel} />
            <ellipse cx="500" cy="386" rx="93" ry="17" fill="#C8CBC3" /><path d="M468 301H532V373Q500 387 468 373Z" fill={steel} />
            <path d="M478 311H489V373M516 311V374" fill="none" stroke={bone} strokeWidth="2" />
            <path d="M482 58H518V93H482Z" fill={steel} />
            <path d="M437 37 445 29H555L563 37V61L555 69H445L437 61Z" fill={wine} />
            <path d="M450 39H550" fill="none" stroke="#AE7881" strokeWidth="1.5" />
            <path d="M397 93 407 81H593L603 93V241H397Z" fill={oak} />
            <path d="M408 99 414 93H586L592 99V231H408Z" fill={wine} />
            <path d="M424 110H576V215H424Z" fill="none" stroke="#AD7380" strokeWidth="1.5" />
            <path d="M431 127H569M431 145H569M431 163H569M431 181H569M431 199H569" stroke="#AD7380" strokeWidth="1.5" />
            <path d="M395 259Q359 253 355 217V193M605 259Q641 253 645 217V193" stroke={ink} strokeWidth="12" fill="none" />
            <path d="M395 258Q362 250 361 216V193M605 258Q638 250 639 216V193" stroke={steel} strokeWidth="7" fill="none" />
            <path d="M344 184 354 178H395L402 190 396 198H351Z" fill={oak} />
            <path d="M656 184 646 178H605L598 190 604 198H649Z" fill={oak} />
            <path d="M354 185H394M606 185H646" stroke="#B49579" strokeWidth="1.5" />
            <path d="M398 235H602L625 267 619 281H381L375 267Z" fill={wine} />
            <path d="M398 247H602L613 265H387Z" fill="#824653" stroke="#B27B85" strokeWidth="1.5" />
            <path d="M375 275Q500 293 625 275V296Q500 315 375 296Z" fill={steel} />
            <path d="M389 286Q500 302 611 286" stroke={bone} fill="none" strokeWidth="2" />
            <path d="M437 305 427 335M563 305 573 335" stroke={ink} strokeWidth="10" />
            <path d="M437 305 427 335M563 305 573 335" stroke={steel} strokeWidth="6" />
            <path d="M425 333H575L589 354 582 361H418L411 354Z" fill={ink} />
            <path d="M430 343H570M425 351H575" stroke={steel} strokeWidth="2" />
        </g>
    </svg>;
}
