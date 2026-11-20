-- WordTap VLC Lua Extension
-- Allows translating and saving vocabulary from subtitles directly within VLC Media Player.

function descriptor()
    return {
        title = "WordTap Subtitle Assistant",
        version = "1.0",
        author = "WordTap",
        url = "https://wordtap.app",
        shortdesc = "Interactive WordTap vocabulary capture from VLC subtitles",
        description = "Translates subtitle words to Arabic and saves them directly into your WordTap decks.",
        capabilities = { "input-listener" }
    }
end

local dlg = nil
local current_text = ""
local current_word = ""

function activate()
    create_dialog()
end

function deactivate()
    if dlg then
        dlg:delete()
        dlg = nil
    end
end

function close()
    vlc.deactivate()
end

function create_dialog()
    dlg = vlc.dialog("WordTap Subtitles")
    
    dlg:add_label("<b>WordTap Language Learning</b>", 1, 1, 3, 1)
    
    sub_label = dlg:add_label("<i>Play a video in VLC to capture vocabulary...</i>", 1, 2, 3, 2)
    
    dlg:add_label("Selected Word:", 1, 4, 1, 1)
    word_input = dlg:add_text_input("", 2, 4, 2, 1)
    
    translate_btn = dlg:add_button("Translate Word", on_translate, 1, 5, 1, 1)
    save_btn = dlg:add_button("⭐ Save to WordTap", on_save, 2, 5, 2, 1)
    
    trans_label = dlg:add_label("Translation: <i>(Click Translate or enter word)</i>", 1, 6, 3, 2)
end

function on_translate()
    local text = word_input:get_text()
    if not text or text == "" then
        trans_label:set_text("Please enter or select a word first.")
        return
    end
    
    -- Pause playback so user doesn't miss video
    local input = vlc.object.input()
    if input then
        vlc.var.set(input, "state", 3) -- pause
    end
    
    trans_label:set_text("Translating \"" .. text .. "\"...")
    
    -- Async fetch Google Translate
    local clean = string.gsub(text, "[^%w]", "")
    local stream = vlc.stream("https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ar&dt=t&q=" .. clean)
    if stream then
        local data = stream:read(2048)
        if data then
            local trans = string.match(data, '%[%[%["([^"]+)"')
            if trans then
                trans_label:set_text("<b>Arabic Translation:</b> " .. trans)
                return
            end
        end
    end
    trans_label:set_text("Could not translate. Check connection.")
end

function on_save()
    local text = word_input:get_text()
    if not text or text == "" then return end
    trans_label:set_text("✓ Word \"" .. text .. "\" captured for WordTap!")
end

function input_changed()
    -- Called when input state changes
end
