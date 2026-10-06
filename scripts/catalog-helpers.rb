# frozen_string_literal: true

def catalog_template_for(source)
  templates = Dir[File.join(source, "full.*")].select do |path|
    File.file?(path) && %w[full.liquid full.blade.php].include?(File.basename(path))
  end
  templates.one? ? templates.first : nil
end
